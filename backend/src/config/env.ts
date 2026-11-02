import dotenv from 'dotenv';
import path from 'path';

// Try multiple standard locations for .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
if (typeof __dirname !== 'undefined') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });
}

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  DATABASE_URL:
    process.env.DATABASE_URL ||
    process.env.BACKEND_URL ||
    'postgresql://postgres:postgres@localhost:5432/finance',
  JWT_SECRET:
    process.env.JWT_SECRET || 'ledgerpilot-secret-jwt-key-must-be-at-least-32-chars-long',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  NODE_ENV: process.env.NODE_ENV || 'development',
};

