import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function optimizeDb() {
  console.log('[DB Optimize] Starting LedgerPilot performance index & view optimization...');
  const sqlPath = path.resolve(__dirname, '../db/optimize_indexes.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error('[DB Optimize Error] optimize_indexes.sql not found at:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const client = await pool.connect();
  try {
    console.log('[DB Optimize] Applying indexes and optimized views...');
    await client.query(sql);
    console.log('[DB Optimize] All performance indexes and views applied successfully with zero downtime!');
  } catch (error) {
    console.error('[DB Optimize Error] Optimization failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

optimizeDb();

