import express from 'express';
import { createGame, joinGameByCode, getGameById, assignRolesToGame } from '../lib/store';
import { getIO } from '../socket';

const router = express.Router();

router.post('/create-game', (req, res) => {
  const { hostName, settings } = req.body || {};
  if (!hostName) return res.status(400).json({ error: 'hostName required' });
  const { game, hostToken } = createGame(hostName, settings);
  return res.json({ gameId: game.id, code: game.code, hostToken });
});

router.post('/join-game', async (req, res) => {
  const { code, pseudo } = req.body || {};
  if (!code || !pseudo) return res.status(400).json({ error: 'code and pseudo required' });
  
  const result = joinGameByCode(code, pseudo);
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
  
  // Attendre un peu que le client rejoigne la room Socket.IO
  setTimeout(() => {
    const io = getIO();
    if (io && result.player) {
      console.log(`📢 Émission de player-joined vers game-${result.game.id}:`, {
        playerId: result.player.id,
        playerName: result.player.name,
      });
      io.to(`game-${result.game.id}`).emit('player-joined', {
        playerId: result.player.id,
        playerName: result.player.name,
      });
    }
  }, 100); // Délai de 100ms pour laisser le client rejoindre la room
});

router.get('/game/:id', (req, res) => {
  const id = req.params.id;
  const game = getGameById(id);
  if (!game) return res.status(404).json({ error: 'game not found' });
  return res.json({ game });
});

router.post('/game/:id/assign-roles', (req, res) => {
  const { id } = req.params;
  const { selectedRoles, hostToken } = req.body || {};
  
  if (!selectedRoles) return res.status(400).json({ error: 'selectedRoles required' });
  
  const game = getGameById(id);
  if (!game) return res.status(404).json({ error: 'game not found' });
  
  // Vérifier que c'est bien l'hôte qui fait la demande
  if (game.hostToken !== hostToken) {
    return res.status(403).json({ error: 'only host can assign roles' });
  }
  
  console.log(`🎭 Attribution des rôles pour le jeu ${id}`);
  
  const updatedGame = assignRolesToGame(id, selectedRoles);
  if (!updatedGame) return res.status(500).json({ error: 'failed to assign roles' });
  
  // Émettre l'événement Socket.IO pour notifier tous les joueurs
  const io = getIO();
  if (io) {
    updatedGame.players.forEach(player => {
      console.log(`  → ${player.name} (${player.id}): ${player.roleId || 'narrateur'}`);
    });
    
    io.to(`game-${id}`).emit('roles-assigned', {
      players: updatedGame.players.map(p => ({
        id: p.id,
        name: p.name,
        roleId: p.roleId,
      })),
    });
    console.log(`📢 Événement roles-assigned émis vers game-${id}`);
  }
  
  return res.json({ success: true, game: updatedGame });
});

export default router;
