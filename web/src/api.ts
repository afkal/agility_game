// Calls to the game server. A test key given in the page address
// (`?testi=<key>`) is kept for the browser session and sent with every call.

import type { CalendarDate, DoorState } from '../shared/calendar.ts';

export interface Player {
  id: string;
  name: string;
  dog: string;
}

export interface CalendarDoor {
  day: number;
  state: DoorState;
  best: number | null;
}

export interface Calendar {
  today: CalendarDate;
  season: number | null;
  testMode: boolean;
  doors: CalendarDoor[];
}

export interface LeaderboardEntry {
  name: string;
  dog: string;
  score: number;
}

export interface RunPost {
  playerId: string;
  day: number;
  gingerbread: number;
  hearts: number;
}

export interface Api {
  register(name: string, dog: string): Promise<Player>;
  getPlayer(id: string): Promise<Player | null>;
  setDog(id: string, dog: string): Promise<Player>;
  calendar(playerId: string): Promise<Calendar>;
  leaderboard(day: number): Promise<LeaderboardEntry[]>;
  postRun(run: RunPost): Promise<{ saved: boolean }>;
}

const TEST_KEY_STORAGE = 'agility-camp.test-key';

function testKey(): string | null {
  try {
    const fromUrl = new URLSearchParams(location.search).get('testi');
    if (fromUrl) sessionStorage.setItem(TEST_KEY_STORAGE, fromUrl);
    return sessionStorage.getItem(TEST_KEY_STORAGE);
  } catch {
    return new URLSearchParams(location.search).get('testi');
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = testKey();
  if (key) headers['x-test-key'] = key;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(`${method} ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

export const api: Api = {
  register: (name, dog) => call('POST', '/api/players', { name, dog }),
  async getPlayer(id) {
    const res = await fetch(`/api/players/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET player failed with ${res.status}`);
    return (await res.json()) as Player;
  },
  setDog: (id, dog) => call('PATCH', `/api/players/${encodeURIComponent(id)}`, { dog }),
  calendar: (playerId) => call('GET', `/api/calendar?player=${encodeURIComponent(playerId)}`),
  leaderboard: async (day) => (await call<{ entries: LeaderboardEntry[] }>('GET', `/api/levels/${day}/leaderboard`)).entries,
  postRun: (run) => call('POST', '/api/runs', run),
};
