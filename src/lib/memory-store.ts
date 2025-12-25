import { randomBytes } from 'crypto';
import { Game, Player } from '../types';

// Store en mémoire pour le développement local
const games = new Map<string, Game>();
const gamesByCode = new Map<string, string>(); // code -> gameId

export async function createGame(hostName: string, settings?: Record<string, any>) {
  const id = randomBytes(8).toString('hex');
  const code = randomBytes(3).toString('hex').toUpperCase();
  const hostToken = randomBytes(16).toString('hex');
  const now = Date.now();

  const hostPlayer: Player = {
    id: hostToken,
    name: hostName,
  };

  const game: Game = {
    id,
    code,
    hostToken,
    status: 'lobby',
    settings: settings || {},
    players: [hostPlayer],
    createdAt: now,
  };

  games.set(id, game);
  gamesByCode.set(code, id);

  console.log(`✅ Jeu créé: ${code} (ID: ${id})`);

  return { game, hostToken };
}

export async function joinGameByCode(code: string, pseudo: string) {
  const gameId = gamesByCode.get(code);
  if (!gameId) return null;

  const game = games.get(gameId);
  if (!game) return null;

  // Vérifier le nombre maximum de joueurs basé sur selectedRoles
  const selectedRoles = game.settings?.selectedRoles || {};
  const maxPlayers = Object.values(selectedRoles).reduce((sum: number, count) => sum + (count as number), 0);
  
  // Le narrateur compte comme un joueur dans la liste, donc on compare avec maxPlayers
  if (maxPlayers > 0 && game.players.length > maxPlayers) {
    console.log(`⚠️ Partie pleine: ${game.players.length}/${maxPlayers + 1} joueurs`);
    return { error: 'game is full', maxPlayers: maxPlayers + 1 };
  }

  const playerId = randomBytes(8).toString('hex');
  const player: Player = {
    id: playerId,
    name: pseudo,
  };

  game.players.push(player);

  return { game, player };
}

export async function getGameById(id: string) {
  return games.get(id) || null;
}

export async function assignRolesToGame(gameId: string, selectedRoles: Record<string, number>) {
  const game = games.get(gameId);
  if (!game) return null;

  // Créer un tableau de roleIds basé sur selectedRoles
  const rolePool: string[] = [];
  Object.entries(selectedRoles).forEach(([roleId, count]) => {
    for (let i = 0; i < count; i++) {
      rolePool.push(roleId);
    }
  });

  // Mélanger les rôles
  const shuffled = [...rolePool].sort(() => Math.random() - 0.5);

  // Attribuer les rôles aux joueurs (sauf le narrateur)
  const playersToAssign = game.players.filter(p => p.id !== game.hostToken);
  
  playersToAssign.forEach((player, index) => {
    if (index < shuffled.length) {
      player.roleId = shuffled[index];
    }
  });

  game.status = 'playing';

  return game;
}

// Nettoyage automatique des parties anciennes (> 24h)
setInterval(() => {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  
  for (const [id, game] of games.entries()) {
    if (now - game.createdAt > DAY_MS) {
      games.delete(id);
      gamesByCode.delete(game.code);
      console.log(`🗑️ Partie supprimée (expirée): ${game.code}`);
    }
  }
}, 60 * 60 * 1000); // Vérifier toutes les heures
