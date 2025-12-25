import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';

// Utiliser PostgreSQL si DATABASE_URL est défini, sinon memory-store
const USE_POSTGRES = !!process.env.DATABASE_URL;
const storeModule = USE_POSTGRES 
  ? require('./lib/store')
  : require('./lib/memory-store');

const { updatePlayersStatus, removePlayer } = storeModule;

// Délai simulé (ms) pour tester l'indicateur de chargement côté client.
// Configurez via la variable d'environnement SIMULATE_DELAY_MS (ex: 1500)
const SIMULATE_DELAY_MS = Number(process.env.SIMULATE_DELAY_MS ?? 0);

let io: IOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new IOServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('🔌 Client connecté:', socket.id);
    
    // Handler pour rejoindre une room de jeu
    socket.on('join-room', async ({ gameId, playerId, playerName }) => {
      socket.join(`game-${gameId}`);
      console.log(`✅ Socket ${socket.id} a rejoint la room game-${gameId} (${playerName || 'inconnu'})`);

      // Notifier les autres joueurs qu'un nouveau joueur est dans la room
      if (playerName && playerId) {
        socket.to(`game-${gameId}`).emit('player-joined', { playerId, playerName });
      } else {
        // Fallback pour les anciens clients ou reconnexions
        socket.to(`game-${gameId}`).emit('player-connected', { socketId: socket.id });
      }
    });

    // Handler pour synchroniser l'état du jeu (utilisé par le narrateur)
    socket.on('sync-game-state', async ({ gameId, gameState }) => {
      console.log(`🔄 Synchronisation de l'état pour la room game-${gameId}`);
      
      // Persister le statut de vie des joueurs si présent
      if (gameState.players) {
        try {
          await updatePlayersStatus(gameId, gameState.players);
          console.log(`✅ Statut de vie persisté pour ${gameState.players.length} joueurs`);
        } catch (err) {
          console.error('❌ Erreur lors de la persistance du statut de vie:', err);
        }
      }
      
      socket.to(`game-${gameId}`).emit('game-state-updated', gameState);
    });

    // Handler pour expulser un joueur
    socket.on('kick-player', async ({ gameId, playerId }) => {
      console.log(`🚫 Expulsion du joueur ${playerId} de la room game-${gameId}`);
      try {
        await removePlayer(gameId, playerId);
        // Notifier tout le monde (y compris le joueur expulsé)
        io?.to(`game-${gameId}`).emit('player-kicked', { playerId });
      } catch (err) {
        console.error('❌ Erreur lors de l\'expulsion du joueur:', err);
      }
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
