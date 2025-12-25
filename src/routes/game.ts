import express from 'express';
import { getIO } from '../socket';
import { Player } from '../types';

// Utiliser PostgreSQL si DATABASE_URL est défini, sinon memory-store
const USE_POSTGRES = !!process.env.DATABASE_URL;
const storeModule = USE_POSTGRES 
  ? require('../lib/store')
  : require('../lib/memory-store');

const { createGame, joinGameByCode, getGameById, assignRolesToGame } = storeModule;

const router = express.Router();

router.post('/create-game', async (req, res) => {
  const { hostName, settings } = req.body || {};
  if (!hostName) return res.status(400).json({ error: 'hostName required' });
  try {
    const { game, hostToken } = await createGame(hostName, settings);
    return res.json({ gameId: game.id, code: game.code, hostToken });
  } catch (err) {
    console.error('create-game error', err);
    // Expose minimal error details for debugging (remove or soften in production)
    return res.status(500).json({ error: 'failed to create game', details: (err as Error).message });
  }
});

router.post('/join-game', async (req, res) => {
  const { code, pseudo } = req.body || {};
  if (!code || !pseudo) return res.status(400).json({ error: 'code and pseudo required' });
  
  const result = await joinGameByCode(code, pseudo);
  if (!result) return res.status(404).json({ error: 'game not found' });
  
  // Vérifier si la partie est pleine
  if ('error' in result && result.error === 'game is full') {
    console.log(`⚠️ ${pseudo} a essayé de rejoindre mais la partie est pleine (${result.maxPlayers} joueurs max)`);
    return res.status(403).json({ error: 'game is full', maxPlayers: result.maxPlayers });
  }
  
  // À ce stade, result contient game et player
  if (!result.player) {
    return res.status(500).json({ error: 'failed to add player' });
  }
  
  console.log(`🎮 ${pseudo} rejoint le jeu ${result.game.id} (code: ${code}) - ${result.game.players.length} joueurs`);
  
  // Répondre immédiatement au client
  res.json({ playerId: result.player.id, gameId: result.game.id });
  
  // Note: L'événement 'player-joined' est maintenant géré par le socket.on('join-room')
  // pour plus de fiabilité une fois que le client est réellement dans la room.
});

router.get('/game/:id', async (req, res) => {
  const id = req.params.id;
  const game = await getGameById(id);
  if (!game) return res.status(404).json({ error: 'game not found' });
  return res.json({ game });
});

router.post('/game/:id/assign-roles', async (req, res) => {
  const { id } = req.params;
  const { selectedRoles, hostToken } = req.body || {};
  
  if (!selectedRoles) return res.status(400).json({ error: 'selectedRoles required' });
  
  const game = await getGameById(id);
  if (!game) return res.status(404).json({ error: 'game not found' });
  
  // Vérifier que c'est bien l'hôte qui fait la demande
  if (game.hostToken !== hostToken) {
    return res.status(403).json({ error: 'only host can assign roles' });
  }
  
  console.log(`🎭 Attribution des rôles pour le jeu ${id}`);
  
  try {
    const updatedGame = await assignRolesToGame(id, selectedRoles);
    if (!updatedGame) return res.status(500).json({ error: 'failed to assign roles' });
    
    // Émettre l'événement Socket.IO pour notifier tous les joueurs
    const io = getIO();
    if (io) {
      updatedGame.players.forEach((player: Player) => {
        console.log(`  → ${player.name} (${player.id}): ${player.roleId || 'narrateur'}`);
      });
      
      io.to(`game-${id}`).emit('roles-assigned', {
        players: updatedGame.players.map((p: Player) => ({
          id: p.id,
          name: p.name,
          roleId: p.roleId,
        })),
      });
      console.log(`📢 Événement roles-assigned émis vers game-${id}`);
    }
    
    return res.json({ success: true, game: updatedGame });
  } catch (err) {
    console.error('assign-roles error', err);
    return res.status(500).json({ error: 'failed to assign roles' });
  }
});

export default router;
