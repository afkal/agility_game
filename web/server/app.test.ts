import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { christmasCourse } from '../shared/levels/christmas.ts';
import { createApp } from './app.ts';
import { Store } from './db.ts';

const TEST_KEY = 'secret';

function setup(date: string, staticRoot?: string) {
  const app = createApp({ store: new Store(':memory:'), now: () => new Date(date), testKey: TEST_KEY, staticRoot });
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text.startsWith('{') ? JSON.parse(text) : text, headers: res.headers };
  };
  const register = async (name: string, dog = 'elmo') => (await call('POST', '/api/players', { name, dog })).body;
  const postRun = (playerId: string, gingerbread: number, hearts: number, day = 1) =>
    call('POST', '/api/runs', { playerId, day, gingerbread, hearts });
  return { call, register, postRun };
}

// Noon in Finland on the given December 2026 day.
const december = (day: number) => `2026-12-${String(day).padStart(2, '0')}T10:00:00Z`;

describe('players', () => {
  it('creates a new player with its own sign-in code even when the name is taken', async () => {
    const { register } = setup(december(3));
    const first = await register('Marjaana');
    const second = await register('Marjaana', 'alma');
    expect(second.id).not.toBe(first.id);
    expect(first.pin).toMatch(/^\d{6}$/);
    expect(second.pin).not.toBe(first.pin);
  });

  it('signs a player in on another device with their code', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo', 'laku');
    expect((await call('POST', '/api/players/sign-in', { pin: ` ${player.pin.slice(0, 3)} ${player.pin.slice(3)} ` })).body).toEqual(player);
    const wrong = player.pin === '000000' ? '111111' : '000000';
    expect((await call('POST', '/api/players/sign-in', { pin: wrong })).status).toBe(404);
    expect((await call('POST', '/api/players/sign-in', { pin: '12ab' })).status).toBe(404);
  });

  it('stops answering sign-ins from an address after too many wrong codes', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo');
    const wrong = player.pin === '000000' ? '111111' : '000000';
    const from = { 'x-forwarded-for': '10.0.0.9' };
    for (let i = 0; i < 10; i++) await call('POST', '/api/players/sign-in', { pin: wrong }, from);
    expect((await call('POST', '/api/players/sign-in', { pin: player.pin }, from)).status).toBe(429);
    expect((await call('POST', '/api/players/sign-in', { pin: player.pin }, { 'x-forwarded-for': '10.0.0.10' })).status).toBe(200);
  });

  it('renames a player without changing who they are', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo');
    const renamed = await call('PATCH', `/api/players/${player.id}`, { name: '  Timppa ' });
    expect(renamed.body).toEqual({ ...player, name: 'Timppa' });
    expect((await call('PATCH', `/api/players/${player.id}`, { name: '' })).status).toBe(400);
    expect((await call('PATCH', '/api/players/nobody', { name: 'X' })).status).toBe(404);
  });

  it('rejects empty, blank and too long names and unknown dogs', async () => {
    const { call } = setup(december(3));
    for (const name of ['', '   ', 'x'.repeat(21)]) {
      expect((await call('POST', '/api/players', { name, dog: 'elmo' })).status).toBe(400);
    }
    expect((await call('POST', '/api/players', { name: 'Timo', dog: 'rex' })).status).toBe(400);
    expect((await call('POST', '/api/players', { name: 'x'.repeat(20), dog: 'elmo' })).status).toBe(200);
  });

  it('keeps the player and their best scores when the dog changes', async () => {
    const { call, register, postRun } = setup(december(3));
    const player = await register('Timo');
    await postRun(player.id, 20, 3);
    const changed = await call('PATCH', `/api/players/${player.id}`, { dog: 'laku' });
    expect(changed.body).toEqual({ ...player, dog: 'laku' });
    const calendar = await call('GET', `/api/calendar?player=${player.id}`);
    expect(calendar.body.doors[0].best).toBe(350);
  });
});

describe('calendar', () => {
  it('opens door 1 on 1 December by the Finnish date and keeps later doors closed', async () => {
    const { call } = setup('2026-11-30T22:30:00Z');
    const { body } = await call('GET', '/api/calendar');
    expect(body.today).toEqual({ year: 2026, month: 12, day: 1 });
    expect(body.doors[0].state).toBe('open');
    expect(body.doors[1].state).toBe('closed');
  });

  it('shows a door whose level is not released yet as coming soon', async () => {
    const { call } = setup(december(3));
    const { body } = await call('GET', '/api/calendar');
    expect(body.doors.slice(0, 4).map((d: { state: string }) => d.state)).toEqual([
      'open',
      'coming-soon',
      'coming-soon',
      'closed',
    ]);
  });

  it('keeps every door closed before December', async () => {
    const { call } = setup('2026-11-30T10:00:00Z');
    const { body } = await call('GET', '/api/calendar');
    expect(body.doors.every((d: { state: string }) => d.state === 'closed')).toBe(true);
  });
});

describe('runs and leaderboards', () => {
  it('lists each player once with their best score, highest first', async () => {
    const { call, register, postRun } = setup(december(3));
    const eveliina = await register('Eveliina');
    const timo = await register('Timo', 'laku');
    for (const [cookies, hearts] of [
      [20, 1],
      [28, 1],
      [23, 1],
    ] as const) {
      await postRun(eveliina.id, cookies, hearts);
    }
    await postRun(timo.id, 10, 3);
    const { body } = await call('GET', '/api/levels/1/leaderboard');
    expect(body.entries).toEqual([
      { name: 'Eveliina', dog: 'elmo', score: 330 },
      { name: 'Timo', dog: 'laku', score: 250 },
    ]);
  });

  it('stores the score computed from cookies and hearts, whatever the client claims', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo');
    const res = await call('POST', '/api/runs', { playerId: player.id, day: 1, gingerbread: 23, hearts: 2, score: 99_999 });
    expect(res.body).toEqual({
      saved: true,
      test: false,
      score: 330,
      best: 330,
      newItem: { id: 'santa-hat', name: 'Tonttulakki' },
      outfit: { neck: 'collar', head: 'santa-hat' },
    });
  });

  it('rejects a run for a door that is not open', async () => {
    const { register, postRun, call } = setup('2026-11-30T10:00:00Z');
    const player = await register('Timo');
    expect((await postRun(player.id, 5, 3)).status).toBe(400);
    expect((await postRun(player.id, 5, 3, 4)).status).toBe(400);
    expect((await call('GET', '/api/levels/1/leaderboard')).body.entries).toEqual([]);
  });

  it('rejects impossible cookie counts and hearts, and unknown players', async () => {
    const { register, postRun } = setup(december(3));
    const player = await register('Timo');
    const total = christmasCourse().cookies.length;
    expect((await postRun(player.id, total + 1, 3)).status).toBe(400);
    expect((await postRun(player.id, total, 4)).status).toBe(400);
    expect((await postRun(player.id, 5, 0)).status).toBe(400);
    expect((await postRun('nobody', 5, 3)).status).toBe(400);
    expect((await postRun(player.id, total, 3)).status).toBe(200);
  });

  it('keeps test-mode runs in their own list, apart from real results', async () => {
    const { call, register, postRun } = setup('2026-11-30T10:00:00Z');
    const player = await register('Timo');
    const test = { 'x-test-key': TEST_KEY };
    const res = await call('POST', '/api/runs', { playerId: player.id, day: 1, gingerbread: 5, hearts: 3 }, test);
    expect(res.body).toMatchObject({ saved: true, test: true, score: 200, best: 200 });
    expect((await call('GET', '/api/levels/1/leaderboard', undefined, test)).body.entries).toEqual([
      { name: 'Timo', dog: 'elmo', score: 200 },
    ]);
    expect((await call('GET', `/api/calendar?player=${player.id}`, undefined, test)).body.doors[0].best).toBe(200);
    expect((await call('GET', '/api/levels/1/leaderboard')).body.entries).toEqual([]);
    expect((await postRun(player.id, 5, 3)).status).toBe(400);
  });

  it('opens released doors early in test mode only with the right key', async () => {
    const { call } = setup('2026-11-30T10:00:00Z');
    expect((await call('GET', '/api/calendar', undefined, { 'x-test-key': TEST_KEY })).body.doors[0].state).toBe('open');
    expect((await call('GET', '/api/calendar', undefined, { 'x-test-key': 'wrong' })).body.doors[0].state).toBe('closed');
  });

  it('stores runs after New Year in the previous season', async () => {
    const { call, register, postRun } = setup('2027-01-02T10:00:00Z');
    const player = await register('Timo');
    expect((await call('GET', '/api/calendar')).body.season).toBe(2026);
    expect((await postRun(player.id, 5, 3)).status).toBe(200);
    expect((await call('GET', '/api/levels/1/leaderboard')).body.entries).toHaveLength(1);
  });
});

describe('warm-up course', () => {
  it('is free practice: its runs are never saved', async () => {
    const { call, register, postRun } = setup(december(3));
    const player = await register('Timo');
    expect((await postRun(player.id, 10, 3, 0)).status).toBe(400);
    expect((await call('GET', '/api/levels/0/leaderboard')).status).toBe(400);
  });
});

describe('starting line', () => {
  it('lists who has joined with their dog dressed, without codes or ids', async () => {
    const { call, register, postRun } = setup(december(3));
    const timo = await register('Timo', 'laku');
    await register('Eveliina', 'alma');
    await postRun(timo.id, 5, 3);
    const { body } = await call('GET', '/api/roster');
    expect(body.players).toEqual([
      { name: 'Timo', dog: 'laku', outfit: { neck: 'collar', head: 'santa-hat' } },
      { name: 'Eveliina', dog: 'alma', outfit: { neck: 'collar' } },
    ]);
  });

  it('shows the test-mode outfits in test mode', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo');
    const test = { 'x-test-key': TEST_KEY };
    await call('PUT', `/api/players/${player.id}/outfit`, { dog: 'elmo', slot: 'head', item: 'antlers' }, test);
    expect((await call('GET', '/api/roster', undefined, test)).body.players[0].outfit).toEqual({ neck: 'collar', head: 'antlers' });
    expect((await call('GET', '/api/roster')).body.players[0].outfit).toEqual({ neck: 'collar' });
  });
});

describe('wardrobe', () => {
  it('starts every dog in its collar', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo');
    const { body } = await call('GET', `/api/players/${player.id}/wardrobe`);
    expect(body.dogs.elmo).toEqual({ unlocked: ['collar'], outfit: { neck: 'collar' } });
    expect(body.dogs.alma.outfit).toEqual({ neck: 'collar' });
  });

  it('wins a door item once, for the dog that finished it, and puts it on', async () => {
    const { call, register, postRun } = setup(december(3));
    const player = await register('Timo', 'laku');
    const first = (await postRun(player.id, 5, 3)).body;
    expect(first.newItem).toEqual({ id: 'santa-hat', name: 'Tonttulakki' });
    expect(first.outfit).toEqual({ neck: 'collar', head: 'santa-hat' });
    expect((await postRun(player.id, 6, 3)).body.newItem).toBeNull();
    const { body } = await call('GET', `/api/players/${player.id}/wardrobe`);
    expect(body.dogs.laku.unlocked).toContain('santa-hat');
    expect(body.dogs.elmo.unlocked).not.toContain('santa-hat');

    await call('PATCH', `/api/players/${player.id}`, { dog: 'alma' });
    expect((await postRun(player.id, 5, 3)).body.newItem).toEqual({ id: 'santa-hat', name: 'Tonttulakki' });
  });

  it('dresses a dog only in items it has won, and keeps something on its neck', async () => {
    const { call, register, postRun } = setup(december(3));
    const player = await register('Timo');
    const put = (body: unknown) => call('PUT', `/api/players/${player.id}/outfit`, body);
    expect((await put({ dog: 'elmo', slot: 'head', item: 'santa-hat' })).status).toBe(400);
    await postRun(player.id, 5, 3);
    expect((await put({ dog: 'elmo', slot: 'neck', item: 'santa-hat' })).status).toBe(400);
    expect((await put({ dog: 'elmo', slot: 'head', item: null })).body.dogs.elmo.outfit).toEqual({ neck: 'collar' });
    expect((await put({ dog: 'elmo', slot: 'neck', item: null })).body.dogs.elmo.outfit).toEqual({ neck: 'collar' });
    expect((await put({ dog: 'elmo', slot: 'head', item: 'santa-hat' })).body.dogs.elmo.outfit).toEqual({ neck: 'collar', head: 'santa-hat' });
    expect((await call('GET', `/api/players/${player.id}/wardrobe`)).body.dogs.laku.outfit).toEqual({ neck: 'collar' });
  });
});

describe('wardrobe in test mode', () => {
  it('lets every dog wear every item, without touching what real play has won', async () => {
    const { call, register } = setup(december(3));
    const player = await register('Timo');
    const test = { 'x-test-key': TEST_KEY };
    const wardrobe = (await call('GET', `/api/players/${player.id}/wardrobe`, undefined, test)).body;
    expect(wardrobe.dogs.alma.unlocked).toContain('star-band');
    const put = await call('PUT', `/api/players/${player.id}/outfit`, { dog: 'alma', slot: 'head', item: 'star-band' }, test);
    expect(put.body.dogs.alma.outfit.head).toBe('star-band');
    const real = (await call('GET', `/api/players/${player.id}/wardrobe`)).body;
    expect(real.dogs.alma.unlocked).toEqual(['collar']);
    expect(real.dogs.alma.outfit).toEqual({ neck: 'collar' });
  });
});

describe('test mode switched off', () => {
  it('saves runs and reports no test mode when no test key is configured', async () => {
    const app = createApp({ store: new Store(':memory:'), now: () => new Date(december(3)) });
    const json = { 'content-type': 'application/json' };
    const player = await (await app.request('/api/players', { method: 'POST', headers: json, body: JSON.stringify({ name: 'Timo', dog: 'elmo' }) })).json();
    const calendar = await (await app.request('/api/calendar')).json();
    expect(calendar.testMode).toBe(false);
    const run = await app.request('/api/runs', { method: 'POST', headers: { ...json, 'x-test-key': '' }, body: JSON.stringify({ playerId: player.id, day: 1, gingerbread: 5, hearts: 3 }) });
    expect(await run.json()).toMatchObject({ saved: true });
  });
});

describe('static files', () => {
  it('serves the page uncached and hashed build files as immutable', async () => {
    const root = mkdtempSync(join(tmpdir(), 'agility-static-'));
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>Agility Camp</title>');
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'assets', 'index-abc123.js'), 'console.log(1)');
    const { call } = setup(december(3), root);
    const page = await call('GET', '/');
    expect(page.headers.get('cache-control')).toBe('no-cache');
    const deepLink = await call('GET', '/calendar');
    expect(deepLink.body).toContain('Agility Camp');
    const asset = await call('GET', '/assets/index-abc123.js');
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await call('GET', '/assets/startGame-gone.js')).status).toBe(404);
  });
});
