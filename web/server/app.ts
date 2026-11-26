// The HTTP app: the JSON API under /api and the built game files.

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { type CalendarDate, DOOR_COUNT, FIRST_SEASON, doorStates, helsinkiDate, seasonOf } from '../shared/calendar.ts';
import { STARTING_HEARTS } from '../shared/constants.ts';
import { LEVELS, WARMUP, cookieCount, levelForDay } from '../shared/levels/registry.ts';
import { DOG_IDS, type DogId, cleanName, cleanPin, isDogId } from '../shared/profiles.ts';
import { ITEMS, type Outfit, SLOTS, type Slot, itemById, itemForDay, resolveOutfit, unlockedItems } from '../shared/wardrobe.ts';
import { score } from '../shared/score.ts';
import type { Store } from './db.ts';

export interface AppOptions {
  store: Store;
  /** The current time; tests fix it. */
  now?: () => Date;
  /** Secret that turns on test mode when sent in the `X-Test-Key` header. */
  testKey?: string;
  /** Directory of the built game, served next to the API. */
  staticRoot?: string;
}

const released = new Set(LEVELS.map((level) => level.day));

/** In test mode every dog may wear every item, so all of them can be tried in play. */
const ALL_ITEMS = ITEMS.map((item) => item.id);

/** Wrong sign-in codes allowed from one address before it has to wait. */
const MAX_FAILED_SIGN_INS = 10;
const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;

export function createApp(options: AppOptions): Hono {
  const { store } = options;
  const now = options.now ?? (() => new Date());
  const isTest = (key: string | undefined) => Boolean(options.testKey) && key === options.testKey;
  const app = new Hono();

  // Registering always creates a new player; the same name may belong to
  // several players. The returned code signs the player in elsewhere.
  app.post('/api/players', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = cleanName(body?.name);
    if (!name || !isDogId(body?.dog)) return c.json({ error: 'invalid-player' }, 400);
    return c.json(store.createPlayer(name, body.dog));
  });

  const failedSignIns = new Map<string, { count: number; since: number }>();
  app.post('/api/players/sign-in', async (c) => {
    // The reverse proxy appends the real address last; earlier entries come from the caller.
    const address = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim() || clientAddress(c.env) || 'unknown';
    const time = now().getTime();
    const failures = failedSignIns.get(address);
    if (failures && time - failures.since > SIGN_IN_WINDOW_MS) failedSignIns.delete(address);
    if ((failedSignIns.get(address)?.count ?? 0) >= MAX_FAILED_SIGN_INS) return c.json({ error: 'too-many-tries' }, 429);

    const body = await c.req.json().catch(() => null);
    const pin = cleanPin(body?.pin);
    const player = pin ? store.playerByPin(pin) : undefined;
    if (!player) {
      const entry = failedSignIns.get(address) ?? { count: 0, since: time };
      entry.count += 1;
      failedSignIns.set(address, entry);
      return c.json({ error: 'unknown-pin' }, 404);
    }
    return c.json(player);
  });

  app.get('/api/players/:id', (c) => {
    const player = store.getPlayer(c.req.param('id'));
    return player ? c.json(player) : c.json({ error: 'not-found' }, 404);
  });

  app.patch('/api/players/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    const dog = body?.dog === undefined ? undefined : body.dog;
    const name = body?.name === undefined ? undefined : cleanName(body.name);
    if ((dog !== undefined && !isDogId(dog)) || name === null || (dog === undefined && name === undefined)) {
      return c.json({ error: 'invalid-player' }, 400);
    }
    const id = c.req.param('id');
    if (!store.getPlayer(id)) return c.json({ error: 'not-found' }, 404);
    store.updatePlayer(id, { dog, name });
    return c.json(store.getPlayer(id));
  });

  /** Every dog's items and current outfit for the player. */
  const wardrobeOf = (playerId: string, testMode: boolean) => {
    const finished = store.finishedDays(playerId, testMode);
    const dogs = {} as Record<DogId, { unlocked: string[]; outfit: Outfit }>;
    for (const dog of DOG_IDS) {
      const unlocked = testMode ? ALL_ITEMS : unlockedItems(finished.get(dog) ?? []);
      dogs[dog] = { unlocked, outfit: resolveOutfit(store.storedOutfit(playerId, dog), unlocked) };
    }
    return { dogs };
  };

  app.get('/api/players/:id/wardrobe', (c) => {
    const id = c.req.param('id');
    if (!store.getPlayer(id)) return c.json({ error: 'not-found' }, 404);
    return c.json(wardrobeOf(id, isTest(c.req.header('x-test-key'))));
  });

  // Put an item on a dog, or take a slot's item off with `item: null`.
  app.put('/api/players/:id/outfit', async (c) => {
    const id = c.req.param('id');
    if (!store.getPlayer(id)) return c.json({ error: 'not-found' }, 404);
    const body = await c.req.json().catch(() => null);
    const dog = body?.dog;
    const slot = body?.slot as Slot;
    const item = body?.item ?? null;
    if (!isDogId(dog) || !(SLOTS as readonly string[]).includes(slot)) return c.json({ error: 'invalid-outfit' }, 400);
    const testMode = isTest(c.req.header('x-test-key'));
    if (item !== null) {
      const unlocked = testMode ? ALL_ITEMS : unlockedItems(store.finishedDays(id, testMode).get(dog) ?? []);
      if (typeof item !== 'string' || itemById(item)?.slot !== slot || !unlocked.includes(item)) {
        return c.json({ error: 'item-not-available' }, 400);
      }
    }
    store.setOutfitItem(id, dog, slot, item ?? '');
    return c.json(wardrobeOf(id, testMode));
  });

  app.get('/api/calendar', (c) => {
    const today = helsinkiDate(now());
    const testMode = isTest(c.req.header('x-test-key'));
    const season = seasonFor(today, testMode);
    const playerId = c.req.query('player');
    const best = playerId && season !== null ? store.bestScores(playerId, season, testMode) : new Map<number, number>();
    const doors = doorStates(today, released, testMode).map((state, i) => ({
      day: i + 1,
      state,
      best: best.get(i + 1) ?? null,
    }));
    return c.json({ today, season, testMode, doors });
  });

  // Who has joined, with their dog as it is dressed, for the calendar's starting line.
  app.get('/api/roster', (c) => {
    const players = store.listPlayers().map((p) => ({ name: p.name, dog: p.dog, outfit: wardrobeOf(p.id, false).dogs[p.dog].outfit }));
    return c.json({ players });
  });

  app.get('/api/levels/:day/leaderboard', (c) => {
    const day = Number(c.req.param('day'));
    if (!Number.isInteger(day) || day < 1 || day > DOOR_COUNT) return c.json({ error: 'invalid-day' }, 400);
    const testMode = isTest(c.req.header('x-test-key'));
    const season = seasonFor(helsinkiDate(now()), testMode);
    return c.json({ day, entries: season === null ? [] : store.leaderboard(season, day, testMode) });
  });

  app.post('/api/runs', async (c) => {
    const body = await c.req.json().catch(() => null);
    const testMode = isTest(c.req.header('x-test-key'));

    const player = typeof body?.playerId === 'string' ? store.getPlayer(body.playerId) : undefined;
    if (!player) return c.json({ error: 'unknown-player' }, 400);

    const day = Number(body?.day);
    const level = levelForDay(day);
    const today = helsinkiDate(now());
    const season = seasonFor(today, testMode);
    // The warm-up is free practice and is never saved.
    if (!level || day === WARMUP.day || season === null || doorStates(today, released, testMode)[day - 1] !== 'open') {
      return c.json({ error: 'door-not-open' }, 400);
    }

    const { gingerbread, hearts } = body;
    const validCookies = Number.isInteger(gingerbread) && gingerbread >= 0 && gingerbread <= cookieCount(level);
    const validHearts = Number.isInteger(hearts) && hearts >= 1 && hearts <= STARTING_HEARTS;
    if (!validCookies || !validHearts) return c.json({ error: 'invalid-run' }, 400);

    const points = score(gingerbread, hearts);
    // The dog is the one the player has chosen, as the game runs with it.
    const firstFinish = !(store.finishedDays(player.id, testMode).get(player.dog) ?? []).includes(day);
    store.addRun({ playerId: player.id, dog: player.dog, season, day, gingerbread, hearts, score: points, test: testMode });
    const best = store.bestScores(player.id, season, testMode).get(day) ?? points;
    const won = firstFinish ? itemForDay(day) : undefined;
    // A newly won item goes straight on, in place of whatever was in its slot.
    if (won) store.setOutfitItem(player.id, player.dog, won.slot, won.id);
    const newItem = won ? { id: won.id, name: won.look(player.dog).name } : null;
    const outfit = wardrobeOf(player.id, testMode).dogs[player.dog].outfit;
    return c.json({ saved: true, test: testMode, score: points, best, newItem, outfit });
  });

  app.all('/api/*', (c) => c.json({ error: 'not-found' }, 404));

  if (options.staticRoot) {
    const root = options.staticRoot;
    // Hashed build files never change; the page itself is always revalidated,
    // so phones pick up new levels on their next visit.
    app.use('*', async (c, next) => {
      await next();
      if (c.req.path.startsWith('/assets/')) {
        c.header('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (c.res.headers.get('content-type')?.startsWith('text/html')) {
        c.header('Cache-Control', 'no-cache');
      }
    });
    app.use('*', serveStatic({ root }));
    // A build file that no longer exists must fail plainly, not load the page in its place.
    app.get('/assets/*', (c) => c.text('Not found', 404));
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return app;
}

/** The season results belong to. Test runs before the first December count towards the first season. */
function seasonFor(today: CalendarDate, testMode: boolean): number | null {
  return seasonOf(today) ?? (testMode ? FIRST_SEASON : null);
}

/** The caller's address when the server runs on Node without a proxy in front. */
function clientAddress(env: unknown): string | undefined {
  return (env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress;
}
