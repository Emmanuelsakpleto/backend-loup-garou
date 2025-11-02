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
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 5174;
server.listen(PORT, () => console.log(`Backend server listening on ${PORT}`));

export default server;
