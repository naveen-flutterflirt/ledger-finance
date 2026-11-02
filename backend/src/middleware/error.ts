import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    const errorMsg = err.issues
      .map(i => `${i.path.join('.') || 'input'}: ${i.message}`)
      .join('; ');
    res.status(400).json({ error: errorMsg });
    return;
  }

  // PostgreSQL Unique Violation
  if (err?.code === '23505') {
    if (err?.constraint === 'users_email_key' || (err?.detail && String(err.detail).includes('email'))) {
      res.status(409).json({ error: 'An account with this email address already exists. Please sign in instead.' });
      return;
    }
    res.status(409).json({ error: 'Already exists: ' + (err.detail ?? err.message) });
    return;
  }

  // PostgreSQL Check Constraint or Trigger Violation
  if (err?.code === '23514') {
    res.status(422).json({ error: err.message });
    return;
  }

  // PostgreSQL Foreign Key Violation
  if (err?.code === '23503') {
    res.status(422).json({ error: 'Linked record missing or still in use' });
    return;
  }

  // Database Connection Timeout / AggregateError
  if (err?.code === 'ETIMEDOUT' || err?.name === 'AggregateError') {
    res.status(504).json({ error: 'Database connection timed out. Please try again.' });
    return;
  }

  console.error('[Unhandled Server Error]', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
}

