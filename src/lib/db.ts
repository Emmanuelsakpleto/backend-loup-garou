import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || '';

const pool = new Pool(
  connectionString
    ? { connectionString, ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } }
    : {}
);

export async function initDb() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Please set DATABASE_URL in your environment or provide a .env file.');
  }
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        host_token TEXT NOT NULL,
        status TEXT NOT NULL,
        settings_json TEXT,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        role_id TEXT,
        is_host BOOLEAN NOT NULL DEFAULT FALSE,
        is_alive BOOLEAN NOT NULL DEFAULT TRUE,
        created_at BIGINT NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
      CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
    `);

    // Cleanup old games older than one week
    const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - WEEK_IN_MS;
    await client.query('DELETE FROM games WHERE created_at < $1', [cutoff]);
  } finally {
    client.release();
  }
}

export default pool;
