import 'express-async-errors';
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/error.js';

export function createApp(): Express {
  const app = express();

  // Basic security headers
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // CORS configuration supporting credentials (cookies) and Authorization header
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || ENV.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true); // Allow dev origins dynamically
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Cookie'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Mount API routers under /api
  app.use('/api', apiRoutes);

  // 404 handler for undefined API endpoints
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global centralized error handler
  app.use(errorHandler);

  return app;
}

