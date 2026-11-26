// The HTTP app: the JSON API under /api and the built game files.

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { DOOR_COUNT, doorStates, helsinkiDate, seasonOf } from '../shared/calendar.ts';
import { STARTING_HEARTS } from '../shared/constants.ts';
import { LEVELS, cookieCount, levelForDay } from '../shared/levels/registry.ts';
import { cleanName, isDogId } from '../shared/profiles.ts';
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

export function createApp(options: AppOptions): Hono {
  const { store } = options;
  const now = options.now ?? (() => new Date());
  const isTest = (key: string | undefined) => Boolean(options.testKey) && key === options.testKey;
  const app = new Hono();

  app.post('/api/players', async (c) => {
    const body = await c.req.json().catch(() => null);
    const name = cleanName(body?.name);
    if (!name || !isDogId(body?.dog)) return c.json({ error: 'invalid-player' }, 400);
    return c.json(store.registerPlayer(name, body.dog));
  });

  app.get('/api/players/:id', (c) => {
    const player = store.getPlayer(c.req.param('id'));
    return player ? c.json(player) : c.json({ error: 'not-found' }, 404);
  });

  app.patch('/api/players/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isDogId(body?.dog)) return c.json({ error: 'invalid-dog' }, 400);
    const id = c.req.param('id');
    if (!store.setDog(id, body.dog)) return c.json({ error: 'not-found' }, 404);
    return c.json(store.getPlayer(id));
  });

  app.get('/api/calendar', (c) => {
    const today = helsinkiDate(now());
    const season = seasonOf(today);
    const testMode = isTest(c.req.header('x-test-key'));
    const playerId = c.req.query('player');
    const best = playerId && season !== null ? store.bestScores(playerId, season) : new Map<number, number>();
    const doors = doorStates(today, released, testMode).map((state, i) => ({
      day: i + 1,
      state,
      best: best.get(i + 1) ?? null,
    }));
    return c.json({ today, season, testMode, doors });
  });

  app.get('/api/levels/:day/leaderboard', (c) => {
    const day = Number(c.req.param('day'));
    if (!Number.isInteger(day) || day < 1 || day > DOOR_COUNT) return c.json({ error: 'invalid-day' }, 400);
    const season = seasonOf(helsinkiDate(now()));
    return c.json({ day, entries: season === null ? [] : store.leaderboard(season, day) });
  });

  app.post('/api/runs', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (isTest(c.req.header('x-test-key'))) return c.json({ saved: false });

    const player = typeof body?.playerId === 'string' ? store.getPlayer(body.playerId) : undefined;
    if (!player) return c.json({ error: 'unknown-player' }, 400);

    const day = Number(body?.day);
    const level = levelForDay(day);
    const today = helsinkiDate(now());
    const season = seasonOf(today);
    if (!level || season === null || doorStates(today, released)[day - 1] !== 'open') {
      return c.json({ error: 'door-not-open' }, 400);
    }

    const { gingerbread, hearts } = body;
    const validCookies = Number.isInteger(gingerbread) && gingerbread >= 0 && gingerbread <= cookieCount(level);
    const validHearts = Number.isInteger(hearts) && hearts >= 1 && hearts <= STARTING_HEARTS;
    if (!validCookies || !validHearts) return c.json({ error: 'invalid-run' }, 400);

    const points = score(gingerbread, hearts);
    store.addRun({ playerId: player.id, season, day, gingerbread, hearts, score: points });
    return c.json({ saved: true, score: points, best: store.bestScores(player.id, season).get(day) ?? points });
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
