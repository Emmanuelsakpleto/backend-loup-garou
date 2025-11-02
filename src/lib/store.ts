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
  
  // Vérifier le nombre maximum de joueurs AVANT d'ajouter
  const maxPlayers = game.settings?.selectedRoles 
    ? Object.values(game.settings.selectedRoles).reduce((sum: number, count) => sum + (count as number), 0) + 1 // +1 pour le narrateur
    : 100; // Pas de limite si pas de rôles sélectionnés
  
  if (game.players.length >= maxPlayers) {
    return { error: 'game is full', maxPlayers, game };
  }
  
  const player: Player = { id: `p-${Date.now()}`, name: pseudo };
  game.players.push(player);
  return { game, player };
}

export function getGameById(id: string) {
  return games.get(id);
}

// Fonction utilitaire pour mélanger un tableau (Fisher-Yates shuffle)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function assignRolesToGame(gameId: string, selectedRoles: Record<string, number>) {
  const game = games.get(gameId);
  if (!game) return null;

  // Construire la liste des rôles à distribuer
  const rolesToAssign: string[] = [];
  for (const roleId in selectedRoles) {
    const count = selectedRoles[roleId];
    for (let i = 0; i < count; i++) {
      rolesToAssign.push(roleId);
    }
  }

  // Mélanger les rôles et les joueurs (sauf le narrateur)
  const shuffledRoles = shuffleArray(rolesToAssign);
  const playersToReceiveRoles = game.players.filter(p => p.id === game.hostToken ? false : true);
  const shuffledPlayers = shuffleArray(playersToReceiveRoles);

  // Assigner les rôles
  shuffledPlayers.forEach((player, index) => {
    if (index < shuffledRoles.length) {
      player.roleId = shuffledRoles[index];
    }
  });

  game.status = 'playing';
  return game;
}
