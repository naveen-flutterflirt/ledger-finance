import { createApp } from './app.js';
import { ENV } from './config/env.js';
import { pool } from './config/database.js';

// Prevent transient socket/DB timeouts from terminating the Node server
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
});

const app = createApp();

async function startServer() {
  try {
    // Test database connection
    const res = await pool.query('SELECT current_database(), current_user, version()');
    console.log(`[Database Connected] DB: ${res.rows[0].current_database} as user: ${res.rows[0].current_user}`);

    app.listen(ENV.PORT, () => {
      console.log(`\n======================================================`);
      console.log(` LedgerPilot Enterprise Accounting API Server`);
      console.log(` Running on: http://localhost:${ENV.PORT}`);
      console.log(` Environment: ${ENV.NODE_ENV}`);
      console.log(`======================================================\n`);
    });
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    process.exit(1);
  }
}

// In local/standalone environments, listen on port. On Vercel, export app as serverless handler.
if (!process.env.VERCEL) {
  startServer();
}

export default app;

