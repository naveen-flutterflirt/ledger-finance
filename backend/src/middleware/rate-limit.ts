import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number; // e.g. 60_000 (1 min)
  maxRequests: number; // e.g. 10
  message?: string;
}

interface ClientRecord {
  timestamps: number[];
}

export function createRateLimiter(opts: RateLimitOptions) {
  const clients = new Map<string, ClientRecord>();

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clients.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < opts.windowMs);
      if (record.timestamps.length === 0) {
        clients.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref(); // unref so it won't hold the Node process alive

  return (req: Request, res: Response, next: NextFunction): void => {
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    let record = clients.get(rawIp);

    if (!record) {
      record = { timestamps: [] };
      clients.set(rawIp, record);
    }

    // Filter out timestamps outside the active window
    record.timestamps = record.timestamps.filter(t => now - t < opts.windowMs);

    if (record.timestamps.length >= opts.maxRequests) {
      const retryAfterSec = Math.ceil(
        (opts.windowMs - (now - record.timestamps[0])) / 1000
      );
      res.setHeader('Retry-After', retryAfterSec > 0 ? retryAfterSec : 60);
      res.status(429).json({
        error: opts.message || 'Too many requests. Please wait a moment and try again.',
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}
