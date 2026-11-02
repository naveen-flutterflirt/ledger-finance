import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (msg: string, duration?: number) => void;
    error: (msg: string, duration?: number) => void;
    info: (msg: string, duration?: number) => void;
    warning: (msg: string, duration?: number) => void;
  };
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  },
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      if (!message) return;
      const id = 'toast_' + Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, message, duration };

      setToasts(prev => [...prev.slice(-4), newToast]); // keep at most 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: useCallback((msg: string, d?: number) => showToast('success', msg, d), [showToast]),
    error: useCallback((msg: string, d?: number) => showToast('error', msg, d || 5000), [showToast]),
    info: useCallback((msg: string, d?: number) => showToast('info', msg, d), [showToast]),
    warning: useCallback((msg: string, d?: number) => showToast('warning', msg, d || 4500), [showToast]),
  };

  return (
    <ToastContext.Provider value={{ toast, showToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast-card toast-${t.type}`} role="alert">
            <div className="toast-icon">
              {t.type === 'success' && <CheckCircle2 size={18} className="toast-icon-svg success" />}
              {t.type === 'error' && <AlertCircle size={18} className="toast-icon-svg error" />}
              {t.type === 'warning' && <AlertTriangle size={18} className="toast-icon-svg warning" />}
              {t.type === 'info' && <Info size={18} className="toast-icon-svg info" />}
            </div>
            <div className="toast-message">{t.message}</div>
            <button
              type="button"
              className="toast-close"
              onClick={() => removeToast(t.id)}
              aria-label="Close notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

