import { Game, Player } from '../types';
import { randomBytes } from 'crypto';

const games = new Map<string, Game>();

export function createGame(hostName: string, settings?: Record<string, any>) {
  const id = randomBytes(8).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase();
  const hostToken = randomBytes(16).toString('hex');
  const game: Game = {
    id,
    code,
    hostToken,
    settings: settings || {},
    players: [{ id: hostToken, name: hostName }], // Utiliser hostToken comme ID du joueur hôte
    status: 'lobby',
    createdAt: Date.now(),
  };
  games.set(id, game);
  return { game, hostToken };
}

export function findGameByCode(code: string): Game | undefined {
  return [...games.values()].find(g => g.code === code);
}

export function joinGameByCode(code: string, pseudo: string) {
  const game = findGameByCode(code);
  if (!game) return null;
  const player: Player = { id: `p-${Date.now()}`, name: pseudo };
  game.players.push(player);
  return { game, player };
}

export function getGameById(id: string) {
  return games.get(id);
}
