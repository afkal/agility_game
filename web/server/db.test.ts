import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { Store } from './db.ts';

describe('Store', () => {
  it('gives players in an older name-matched database a sign-in code and keeps their results', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'agility-db-')), 'old.db');
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE players (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, dog TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE runs (id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT NOT NULL REFERENCES players(id),
        season INTEGER NOT NULL, day INTEGER NOT NULL, gingerbread INTEGER NOT NULL, hearts INTEGER NOT NULL,
        score INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      INSERT INTO players (id, name, name_key, dog) VALUES ('p1', 'Timo', 'timo', 'laku');
      INSERT INTO runs (player_id, season, day, gingerbread, hearts, score) VALUES ('p1', 2026, 1, 10, 3, 250);
    `);
    old.close();

    const store = new Store(path);
    const player = store.getPlayer('p1');
    expect(player).toMatchObject({ id: 'p1', name: 'Timo', dog: 'laku' });
    expect(player?.pin).toMatch(/^\d{6}$/);
    expect(store.leaderboard(2026, 1)).toEqual([{ name: 'Timo', dog: 'laku', score: 250 }]);
    expect(store.createPlayer('Timo', 'elmo').id).not.toBe('p1');
  });
});
