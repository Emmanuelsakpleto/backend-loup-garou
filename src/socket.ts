import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { joinGameByCode } from './lib/store';

// Délai simulé (ms) pour tester l'indicateur de chargement côté client.
// Configurez via la variable d'environnement SIMULATE_DELAY_MS (ex: 1500)
const SIMULATE_DELAY_MS = Number(process.env.SIMULATE_DELAY_MS ?? 0);

let io: IOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new IOServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('🔌 Client connecté:', socket.id);
    
    // Handler pour rejoindre une room de jeu
    socket.on('join-room', async ({ gameId }) => {
      socket.join(`game-${gameId}`);
      console.log(`✅ Socket ${socket.id} a rejoint la room game-${gameId}`);

      // Délai optionnel pour simuler une opération lente (utile pour voir le loader)
      if (SIMULATE_DELAY_MS > 0) {
        try {
          await new Promise((resolve) => setTimeout(resolve, SIMULATE_DELAY_MS));
        } catch (err) {
          // nothing
        }
      }
      
      // Notifier les autres joueurs qu'un nouveau socket est dans la room
      socket.to(`game-${gameId}`).emit('player-connected', { socketId: socket.id });
    });

    // Handler pour synchroniser l'état du jeu (utilisé par le narrateur)
    socket.on('sync-game-state', ({ gameId, gameState }) => {
      console.log(`🔄 Synchronisation de l'état pour la room game-${gameId}`);
      socket.to(`game-${gameId}`).emit('game-state-updated', gameState);
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Client déconnecté:', socket.id);
    });
  });

  return io;
}

export function getIO(): IOServer | null {
  return io;
}
