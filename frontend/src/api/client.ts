import { useCallback, useEffect, useState } from 'react';

const RAW_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_PREFIX = '/api';

export function resolveApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const relativePath = cleanPath.startsWith(API_PREFIX) ? cleanPath : `${API_PREFIX}${cleanPath}`;
  return RAW_BASE ? `${RAW_BASE}${relativePath}` : relativePath;
}

export async function apiCall<T = any>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const url = resolveApiUrl(path);

  const token = localStorage.getItem('lp_token');

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    localStorage.removeItem('lp_token');
    window.location.href = '/login';
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export function useData<T = any>(url: string | null) {
  const [state, setState] = useState<{ url: string | null; data: T | null }>({
    url: null,
    data: null,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!url) return;
    setLoading(true);
    apiCall<T>(url)
      .then(d => {
        setState({ url, data: d });
        setError('');
      })
      .catch(e => {
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    data: state.url === url ? state.data : null,
    error,
    loading,
    reload,
  };
}

