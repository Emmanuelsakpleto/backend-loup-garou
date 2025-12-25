import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import gameRoutes from './routes/game';
import { initSocket } from './socket';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', gameRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', store: process.env.DATABASE_URL ? 'postgresql' : 'memory' });
});

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5174;

// Initialiser la DB si PostgreSQL est configuré
async function startServer() {
  if (process.env.DATABASE_URL) {
    try {
      const { initDb } = await import('./lib/db');
      await initDb();
      console.log('✅ PostgreSQL connected and initialized');
    } catch (err) {
      console.error('❌ Failed to initialize PostgreSQL:', err);
      console.log('⚠️  Falling back to memory store');
    }
  } else {
    console.log('ℹ️  Using in-memory store (no DATABASE_URL set)');
  }
  
  server.listen(PORT, () => console.log(`Backend server listening on ${PORT}`));
}

startServer();

export default server;
