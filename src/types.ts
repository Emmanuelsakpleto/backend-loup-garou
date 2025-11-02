export interface Player {
  id: string;
  name: string;
  roleId?: string;
  isAlive?: boolean;
}

export interface Game {
  id: string;
  code: string;
  hostToken?: string; // store hash in prod
  settings?: Record<string, any>;
  players: Player[];
  status: 'lobby' | 'playing' | 'finished';
  createdAt: number;
}
