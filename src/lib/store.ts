import { randomBytes } from 'crypto';
import db from './db';
import { Game, Player } from '../types';

interface GameRow {
  id: string;
  code: string;
  host_token: string;
  status: string;
  settings_json: string | null;
  created_at: number;
}

interface PlayerRow {
  id: string;
  game_id: string;
  name: string;
  role_id: string | null;
  is_host: number;
  created_at: number;
}

const insertGameStmt = db.prepare(
  'INSERT INTO games (id, code, host_token, status, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?)' 
);

const insertPlayerStmt = db.prepare(
  'INSERT INTO players (id, game_id, name, role_id, is_host, created_at) VALUES (?, ?, ?, ?, ?, ?)' 
);

const selectGameByIdStmt = db.prepare('SELECT * FROM games WHERE id = ?');
const selectGameByCodeStmt = db.prepare('SELECT * FROM games WHERE code = ?');
const selectPlayersByGameStmt = db.prepare('SELECT * FROM players WHERE game_id = ? ORDER BY created_at ASC');
const updateGameStatusStmt = db.prepare('UPDATE games SET status = ?, settings_json = ? WHERE id = ?');
const clearPlayerRolesStmt = db.prepare('UPDATE players SET role_id = NULL WHERE game_id = ? AND is_host = 0');
const updatePlayerRoleStmt = db.prepare('UPDATE players SET role_id = ? WHERE id = ?');

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
  };
}

function mapGameRow(row: GameRow): Game {
  const playerRows = selectPlayersByGameStmt.all(row.id) as PlayerRow[];
  const players = playerRows.map(mapPlayerRow);
  return {
    id: row.id,
    code: row.code,
    hostToken: row.host_token,
    status: row.status as Game['status'],
    settings: deserializeSettings(row.settings_json),
    players,
    createdAt: row.created_at,
  };
}

function loadGameById(id: string): Game | undefined {
  const row = selectGameByIdStmt.get(id) as GameRow | undefined;
  if (!row) return undefined;
  return mapGameRow(row);
}

function loadGameByCode(code: string): Game | undefined {
  const row = selectGameByCodeStmt.get(code) as GameRow | undefined;
  if (!row) return undefined;
  return mapGameRow(row);
}

export function createGame(hostName: string, settings?: Record<string, any>) {
  const id = randomBytes(8).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase();
  const hostToken = randomBytes(16).toString('hex');
  const now = Date.now();

  const settingsJson = serializeSettings(settings || {});

  const createTx = db.transaction(() => {
    insertGameStmt.run(id, code, hostToken, 'lobby', settingsJson, now);
    insertPlayerStmt.run(hostToken, id, hostName, null, 1, now);
  });

  createTx();

  const game = loadGameById(id);
  if (!game) {
    throw new Error('Impossible de charger le jeu après sa création');
  }

  return { game, hostToken };
}

export function findGameByCode(code: string): Game | undefined {
  return loadGameByCode(code);
}

export function joinGameByCode(code: string, pseudo: string) {
  const existingGame = loadGameByCode(code);
  if (!existingGame) return null;

  const maxPlayers = existingGame.settings?.selectedRoles
    ? Object.values(existingGame.settings.selectedRoles).reduce((sum: number, count) => sum + Number(count), 0) + 1
    : 100;

  if (existingGame.players.length >= maxPlayers) {
    return { error: 'game is full', maxPlayers, game: existingGame } as const;
  }

  const playerId = `p-${randomBytes(8).toString('hex')}`;
  const now = Date.now();

  insertPlayerStmt.run(playerId, existingGame.id, pseudo, null, 0, now);

  const updatedGame = loadGameById(existingGame.id);
  if (!updatedGame) {
    throw new Error('Impossible de charger le jeu après avoir ajouté un joueur');
  }

  const newPlayer = updatedGame.players.find((player) => player.id === playerId);
  if (!newPlayer) {
    throw new Error('Joueur ajouté introuvable après insertion');
  }

  return { game: updatedGame, player: newPlayer };
}

export function getGameById(id: string) {
  return loadGameById(id);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function assignRolesToGame(gameId: string, selectedRoles: Record<string, number>) {
  const game = loadGameById(gameId);
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

  const assignTx = db.transaction(() => {
    clearPlayerRolesStmt.run(gameId);

    shuffledPlayers.forEach((player, index) => {
      const roleId = shuffledRoles[index];
      if (roleId) {
        updatePlayerRoleStmt.run(roleId, player.id);
      }
    });

    const mergedSettings = {
      ...(game.settings || {}),
      selectedRoles,
    };

    updateGameStatusStmt.run('playing', serializeSettings(mergedSettings), gameId);
  });

  assignTx();

  return loadGameById(gameId) ?? null;
}
