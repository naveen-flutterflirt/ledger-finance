/**
 * Precision money calculations avoiding floating point inaccuracies.
 * Enforces 2 decimal places (paise precision).
 */
export const r2 = (n: number): number => {
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

export const sum = (xs: number[]): number => {
  return r2(xs.reduce((acc, curr) => acc + curr, 0));
};

