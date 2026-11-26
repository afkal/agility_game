// Starts the game server. Settings come from the environment:
// PORT (default 8787), DB_PATH (default data/agility-camp.db),
// STATIC_ROOT (default dist) and TEST_KEY (test mode off when unset).

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { Store } from './db.ts';

const port = Number(process.env.PORT ?? 8787);
const dbPath = process.env.DB_PATH ?? 'data/agility-camp.db';
mkdirSync(dirname(dbPath), { recursive: true });

const app = createApp({
  store: new Store(dbPath),
  testKey: process.env.TEST_KEY || undefined,
  staticRoot: process.env.STATIC_ROOT ?? 'dist',
});

serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? '127.0.0.1' }, (info) => {
  console.log(`Agility Camp listening on http://${info.address}:${info.port}`);
});
