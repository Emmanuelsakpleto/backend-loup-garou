import dotenv from 'dotenv';
dotenv.config();

import { initDb } from './lib/db';

async function run() {
  try {
    await initDb();
    console.log('✅ Migration / init DB executed');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
