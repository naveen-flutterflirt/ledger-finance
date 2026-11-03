import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { ENV } from './env.js';

// Parse PostgreSQL types into standard JavaScript types
types.setTypeParser(1082, v => v); // DATE -> 'YYYY-MM-DD'
types.setTypeParser(1700, v => parseFloat(v)); // NUMERIC -> number (paise precision)
types.setTypeParser(20, v => parseInt(v, 10)); // BIGINT -> number

export const pool = new Pool({
  connectionString: ENV.DATABASE_URL,
  max: 20, // increased to safely handle parallel reporting and dashboard queries
  connectionTimeoutMillis: 15000, // 15s connection timeout for Neon cloud wakeups
  idleTimeoutMillis: 30000,
  statement_timeout: 15000, // 15s max query execution time to prevent hanging connection pool
  query_timeout: 15000,
  keepAlive: true,
  ssl: ENV.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', err => {
  console.error('[DB Pool Error]', err);
});

export async function query<T extends QueryResultRow = any>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = any>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

