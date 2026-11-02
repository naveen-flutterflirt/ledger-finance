import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  console.log('[DB Init] Starting LedgerPilot database initialization...');
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  const seedPath = path.resolve(__dirname, '../db/seed.sql');

  if (!fs.existsSync(schemaPath) || !fs.existsSync(seedPath)) {
    console.error('[DB Init Error] schema.sql or seed.sql not found at:', schemaPath);
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  const seedSql = fs.readFileSync(seedPath, 'utf-8');

  const client = await pool.connect();
  try {
    console.log('[DB Init] Applying schema.sql...');
    await client.query(schemaSql);
    console.log('[DB Init] schema.sql applied successfully.');

    console.log('[DB Init] Applying seed.sql...');
    await client.query(seedSql);
    console.log('[DB Init] seed.sql applied successfully.');

    console.log('[DB Init] Database setup completed successfully!');
  } catch (error) {
    console.error('[DB Init Error] Database initialization failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();

