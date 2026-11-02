/**
 * Timezone-safe date manipulation for Indian accounting calendars (IST UTC+5:30)
 */
export const today = (): string => {
  return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
};

export function addDays(d: string, n: number): string {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function addMonths(d: string, n: number): string {
  const x = new Date(d + 'T00:00:00Z');
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + n);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);
}

export function monthStart(d: string = today()): string {
  return d.slice(0, 8) + '01';
}

export function fyStart(d: string = today()): string {
  const y = +d.slice(0, 4) - (+d.slice(5, 7) < 4 ? 1 : 0);
  return `${y}-04-01`;
}

