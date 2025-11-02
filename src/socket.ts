import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { joinGameByCode } from './lib/store';

let io: IOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new IOServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('🔌 Client connecté:', socket.id);
    
    socket.on('join-room', ({ gameId }) => {
      socket.join(`game-${gameId}`);
      console.log(`✅ Socket ${socket.id} a rejoint la room game-${gameId}`);
      
      // Notifier les autres joueurs qu'un nouveau socket est dans la room
      socket.to(`game-${gameId}`).emit('player-connected', { socketId: socket.id });
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
