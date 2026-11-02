export const inr = (v: unknown, dec = 0): string => {
  const num = Number(v ?? 0);
  return (
    (num < 0 ? '−₹' : '₹') +
    Math.abs(num).toLocaleString('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    })
  );
};

export const inr2 = (v: unknown): string => inr(v, 2);

export const fmtDate = (v?: string | null): string => {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? v + 'T00:00:00' : v);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const todayStr = (): string => {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

export const monthStart = (): string => {
  return todayStr().slice(0, 8) + '01';
};

export const fyStart = (): string => {
  const t = todayStr();
  const y = +t.slice(0, 4) - (+t.slice(5, 7) < 4 ? 1 : 0);
  return `${y}-04-01`;
};

/** Convert number to Indian currency words format */
export const words = (n: number): string => {
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const w = (x: number): string => {
    if (x < 20) return a[x];
    if (x < 100) return `${b[Math.floor(x / 10)]} ${a[x % 10]}`.trim();
    if (x < 1000) return `${a[Math.floor(x / 100)]} Hundred ${w(x % 100)}`.trim();
    if (x < 1e5) return `${w(Math.floor(x / 1000))} Thousand ${w(x % 1000)}`.trim();
    if (x < 1e7) return `${w(Math.floor(x / 1e5))} Lakh ${w(x % 1e5)}`.trim();
    return `${w(Math.floor(x / 1e7))} Crore ${w(x % 1e7)}`.trim();
  };
  return n === 0 ? 'Zero' : w(Math.round(n));
};

