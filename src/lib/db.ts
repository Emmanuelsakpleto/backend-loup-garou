import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'loup-garou.sqlite');
const dbPath = process.env.SQLITE_DB_PATH ? process.env.SQLITE_DB_PATH : DEFAULT_DB_PATH;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    host_token TEXT NOT NULL,
    status TEXT NOT NULL,
    settings_json TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_id TEXT,
    is_host INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_games_code ON games(code);
  CREATE INDEX IF NOT EXISTS idx_players_game ON players(game_id);
`);

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - WEEK_IN_MS;

db.prepare('DELETE FROM games WHERE created_at < ?').run(cutoff);

export default db;
