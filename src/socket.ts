import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';

export function initSocket(server: HTTPServer) {
  const io = new IOServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('join-room', ({ gameId }) => {
      socket.join(`game-${gameId}`);
    });
  });

  return io;
}
