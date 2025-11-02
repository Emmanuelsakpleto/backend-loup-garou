import { Server as HTTPServer } from 'http';
import { Server as IOServer } from 'socket.io';

let io: IOServer | null = null;

export function initSocket(server: HTTPServer) {
  io = new IOServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('join-room', ({ gameId }) => {
      socket.join(`game-${gameId}`);
    });
  });

  return io;
}

export function getIO(): IOServer | null {
  return io;
}
