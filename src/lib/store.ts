import { randomBytes } from 'crypto';
import pool from './db';
import { Game, Player } from '../types';

type GameRow = {
  id: string;
  code: string;
  host_token: string;
  status: string;
  settings_json: string | null;
  created_at: string | number;
};

type PlayerRow = {
  id: string;
  game_id: string;
  name: string;
  role_id: string | null;
  is_host: boolean;
  is_alive: boolean;
  created_at: string | number;
};

function deserializeSettings(settingsJson: string | null): Record<string, any> | undefined {
  if (!settingsJson) return undefined;
  try {
    return JSON.parse(settingsJson);
  } catch (error) {
    console.error('Erreur lors de la désérialisation des paramètres du jeu:', error);
    return undefined;
  }
}

function serializeSettings(settings?: Record<string, any>): string | null {
  if (!settings) return null;
  try {
    return JSON.stringify(settings);
  } catch (error) {
    console.error('Erreur lors de la sérialisation des paramètres du jeu:', error);
    return null;
  }
}

function mapPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    roleId: row.role_id ?? undefined,
    isAlive: row.is_alive,
  };
}

function mapGameRow(row: GameRow, players: PlayerRow[]): Game {
  const mappedPlayers = players.map(mapPlayerRow);
  return {
    id: row.id,
    code: row.code,
    hostToken: row.host_token,
    status: row.status as Game['status'],
    settings: deserializeSettings(row.settings_json),
    players: mappedPlayers,
    createdAt: Number(row.created_at),
  };
}

async function loadGameById(id: string): Promise<Game | undefined> {
  const client = await pool.connect();
  try {
    const g = await client.query('SELECT * FROM games WHERE id = $1', [id]);
    if (g.rowCount === 0) return undefined;
    const row = g.rows[0] as GameRow;
    const pr = await client.query('SELECT * FROM players WHERE game_id = $1 ORDER BY created_at ASC', [id]);
    const playerRows = pr.rows as PlayerRow[];
    return mapGameRow(row, playerRows);
  } finally {
    client.release();
  }
}

async function loadGameByCode(code: string): Promise<Game | undefined> {
  const client = await pool.connect();
  try {
    const g = await client.query('SELECT * FROM games WHERE code = $1', [code]);
    if (g.rowCount === 0) return undefined;
    const row = g.rows[0] as GameRow;
    const pr = await client.query('SELECT * FROM players WHERE game_id = $1 ORDER BY created_at ASC', [row.id]);
    const playerRows = pr.rows as PlayerRow[];
    return mapGameRow(row, playerRows);
  } finally {
    client.release();
  }
}

export async function createGame(hostName: string, settings?: Record<string, any>) {
  const id = randomBytes(8).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase();
  const hostToken = randomBytes(16).toString('hex');
  const now = Date.now();

  const settingsJson = serializeSettings(settings || {});

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO games (id, code, host_token, status, settings_json, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, code, hostToken, 'lobby', settingsJson, now]
    );
    await client.query(
      'INSERT INTO players (id, game_id, name, role_id, is_host, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [hostToken, id, hostName, null, true, now]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const game = await loadGameById(id);
  if (!game) {
    throw new Error('Impossible de charger le jeu après sa création');
  }

  return { game, hostToken };
}

export async function findGameByCode(code: string): Promise<Game | undefined> {
  return await loadGameByCode(code);
}

export async function joinGameByCode(code: string, pseudo: string) {
  const existingGame = await loadGameByCode(code);
  if (!existingGame) return null;

  const maxPlayers = existingGame.settings?.selectedRoles
    ? Object.values(existingGame.settings.selectedRoles).reduce((sum: number, count) => sum + Number(count), 0) + 1
    : 100;

  if (existingGame.players.length >= maxPlayers) {
    return { error: 'game is full', maxPlayers, game: existingGame } as const;
  }

  const playerId = `p-${randomBytes(8).toString('hex')}`;
  const now = Date.now();

  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO players (id, game_id, name, role_id, is_host, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [playerId, existingGame.id, pseudo, null, false, now]
    );
  } finally {
    client.release();
  }

  const updatedGame = await loadGameById(existingGame.id);
  if (!updatedGame) {
    throw new Error('Impossible de charger le jeu après avoir ajouté un joueur');
  }

  const newPlayer = updatedGame.players.find((player) => player.id === playerId);
  if (!newPlayer) {
    throw new Error('Joueur ajouté introuvable après insertion');
  }

  return { game: updatedGame, player: newPlayer };
}

export async function getGameById(id: string) {
  return await loadGameById(id);
}

export async function removePlayer(gameId: string, playerId: string) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM players WHERE id = $1 AND game_id = $2', [playerId, gameId]);
    return await loadGameById(gameId);
  } finally {
    client.release();
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function assignRolesToGame(gameId: string, selectedRoles: Record<string, number>) {
  const game = await loadGameById(gameId);
  if (!game) return null;

  const rolesToAssign: string[] = [];
  for (const roleId of Object.keys(selectedRoles)) {
    const count = selectedRoles[roleId];
    for (let i = 0; i < count; i++) {
      rolesToAssign.push(roleId);
    }
  }

  const shuffledRoles = shuffleArray(rolesToAssign);
  const playersToReceiveRoles = game.players.filter((player) => player.id !== game.hostToken);
  const shuffledPlayers = shuffleArray(playersToReceiveRoles);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Clear roles for non-hosts
    await client.query('UPDATE players SET role_id = NULL WHERE game_id = $1 AND is_host = FALSE', [gameId]);

    for (let index = 0; index < shuffledPlayers.length; index++) {
      const player = shuffledPlayers[index];
      const roleId = shuffledRoles[index];
      if (roleId) {
        await client.query('UPDATE players SET role_id = $1 WHERE id = $2', [roleId, player.id]);
      }
    }

    const mergedSettings = {
      ...(game.settings || {}),
      selectedRoles,
    };

    await client.query('UPDATE games SET status = $1, settings_json = $2 WHERE id = $3', [
      'playing',
      serializeSettings(mergedSettings),
      gameId,
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return (await loadGameById(gameId)) ?? null;
}

export async function updatePlayersStatus(gameId: string, players: Player[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const player of players) {
      await client.query(
        'UPDATE players SET is_alive = $1 WHERE id = $2 AND game_id = $3',
        [player.isAlive !== false, player.id, gameId]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
