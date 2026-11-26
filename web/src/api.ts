// Calls to the game server. A test key given in the page address
// (`?testi=<key>`) is kept for the browser session and sent with every call.

import type { CalendarDate, DoorState } from '../shared/calendar.ts';
import type { DogId, LeaderboardEntry, Player } from '../shared/profiles.ts';
import type { Outfit, Slot } from '../shared/wardrobe.ts';

export type { LeaderboardEntry, Player };

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

/** For each dog: the items it has won and what it wears. */
export interface Wardrobe {
  dogs: Record<DogId, { unlocked: string[]; outfit: Outfit }>;
}

export interface RunPost {
  playerId: string;
  day: number;
  gingerbread: number;
  hearts: number;
}

export interface Api {
  register(name: string, dog: DogId): Promise<Player>;
  /** The player with this sign-in code, or null if there is none. */
  signIn(pin: string): Promise<Player | null>;
  getPlayer(id: string): Promise<Player | null>;
  updatePlayer(id: string, changes: { dog?: DogId; name?: string }): Promise<Player>;
  calendar(playerId: string): Promise<Calendar>;
  leaderboard(day: number): Promise<LeaderboardEntry[]>;
  postRun(run: RunPost): Promise<{ saved: boolean; test?: boolean; newItem?: { id: string; name: string } | null }>;
  wardrobe(playerId: string): Promise<Wardrobe>;
  /** Put an item on a dog, or take the slot's item off with null. */
  setOutfitItem(playerId: string, dog: DogId, slot: Slot, item: string | null): Promise<Wardrobe>;
}

const TEST_KEY_STORAGE = 'agility-camp.test-key';
/** A request that has not answered by then counts as failed, so the player can retry. */
const REQUEST_TIMEOUT_MS = 10_000;

function testKey(): string | null {
  try {
    const fromUrl = new URLSearchParams(location.search).get('testi');
    if (fromUrl) {
      sessionStorage.setItem(TEST_KEY_STORAGE, fromUrl);
      // Keep the secret out of the address bar, history and shared links.
      const url = new URL(location.href);
      url.searchParams.delete('testi');
      history.replaceState(history.state, '', url);
    }
    return sessionStorage.getItem(TEST_KEY_STORAGE);
  } catch {
    return new URLSearchParams(location.search).get('testi');
  }
}

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const key = testKey();
  if (key) headers['x-test-key'] = key;
  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(res.status, `${method} ${path} failed with ${res.status}`);
  return (await res.json()) as T;
}

export const api: Api = {
  register: (name, dog) => call('POST', '/api/players', { name, dog }),
  async getPlayer(id) {
    const res = await fetch(`/api/players/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET player failed with ${res.status}`);
    return (await res.json()) as Player;
  },
  async signIn(pin) {
    try {
      return await call<Player>('POST', '/api/players/sign-in', { pin });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return null;
      throw error;
    }
  },
  updatePlayer: (id, changes) => call('PATCH', `/api/players/${encodeURIComponent(id)}`, changes),
  calendar: (playerId) => call('GET', `/api/calendar?player=${encodeURIComponent(playerId)}`),
  leaderboard: async (day) => (await call<{ entries: LeaderboardEntry[] }>('GET', `/api/levels/${day}/leaderboard`)).entries,
  postRun: (run) => call('POST', '/api/runs', run),
  wardrobe: (playerId) => call('GET', `/api/players/${encodeURIComponent(playerId)}/wardrobe`),
  setOutfitItem: (playerId, dog, slot, item) =>
    call('PUT', `/api/players/${encodeURIComponent(playerId)}/outfit`, { dog, slot, item }),
};
