import express from 'express';
import { createGame, joinGameByCode, getGameById } from '../lib/store';
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
  
  console.log(`🎮 ${pseudo} rejoint le jeu ${result.game.id} (code: ${code})`);
  
  // Répondre immédiatement au client
  res.json({ playerId: result.player.id, gameId: result.game.id });
  
  // Attendre un peu que le client rejoigne la room Socket.IO
  setTimeout(() => {
    const io = getIO();
    if (io) {
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

export default router;
