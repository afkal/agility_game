// Every database query lives here, so the SQLite driver can be swapped in one
// place.

import { randomInt, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { type DogId, type LeaderboardEntry, PIN_LENGTH, type Player } from '../shared/profiles.ts';

export interface RunRecord {
  playerId: string;
  season: number;
  day: number;
  gingerbread: number;
  hearts: number;
  score: number;
  /** Played in test mode; kept apart from real results. */
  test: boolean;
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.migrateFromNamedPlayers();
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dog TEXT NOT NULL,
        pin TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL REFERENCES players(id),
        season INTEGER NOT NULL,
        day INTEGER NOT NULL,
        gingerbread INTEGER NOT NULL,
        hearts INTEGER NOT NULL,
        score INTEGER NOT NULL,
        test INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS runs_by_level ON runs (season, day);
    `);
  }

  /**
   * Databases from before sign-in codes matched players by name. Give every
   * player a code and drop the one-player-per-name rule, keeping all results.
   */
  private migrateFromNamedPlayers(): void {
    const columns = this.db.prepare("SELECT name FROM pragma_table_info('players')").all() as { name: string }[];
    if (columns.length === 0 || columns.some((c) => c.name === 'pin')) return;
    const players = this.db.prepare('SELECT id, name, dog, created_at FROM players').all() as {
      id: string;
      name: string;
      dog: string;
      created_at: string;
    }[];
    const hasTestColumn = (this.db.prepare("SELECT name FROM pragma_table_info('runs')").all() as { name: string }[]).some(
      (c) => c.name === 'test',
    );
    // Results point at players by id; the ids stay the same while the table is rebuilt.
    this.db.exec('PRAGMA foreign_keys = OFF; BEGIN;');
    try {
      this.db.exec(`
        CREATE TABLE players_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          dog TEXT NOT NULL,
          pin TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
      const insert = this.db.prepare('INSERT INTO players_new (id, name, dog, pin, created_at) VALUES (?, ?, ?, ?, ?)');
      const used = new Set<string>();
      for (const p of players) {
        let pin = newPin();
        while (used.has(pin)) pin = newPin();
        used.add(pin);
        insert.run(p.id, p.name, p.dog, pin, p.created_at);
      }
      this.db.exec('DROP TABLE players; ALTER TABLE players_new RENAME TO players;');
      if (!hasTestColumn) this.db.exec('ALTER TABLE runs ADD COLUMN test INTEGER NOT NULL DEFAULT 0;');
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    } finally {
      this.db.exec('PRAGMA foreign_keys = ON;');
    }
  }

  /** A new player with a fresh sign-in code. Names need not be unique. */
  createPlayer(name: string, dog: DogId): Player {
    const id = randomUUID();
    const trimmed = name.trim();
    const insert = this.db.prepare('INSERT INTO players (id, name, dog, pin) VALUES (?, ?, ?, ?)');
    for (;;) {
      const pin = newPin();
      try {
        insert.run(id, trimmed, dog, pin);
        return { id, name: trimmed, dog, pin };
      } catch (error) {
        // Another player already has this code; draw again.
        if (!String(error).includes('UNIQUE')) throw error;
      }
    }
  }

  getPlayer(id: string): Player | undefined {
    return this.db.prepare('SELECT id, name, dog, pin FROM players WHERE id = ?').get(id) as Player | undefined;
  }

  playerByPin(pin: string): Player | undefined {
    return this.db.prepare('SELECT id, name, dog, pin FROM players WHERE pin = ?').get(pin) as Player | undefined;
  }

  updatePlayer(id: string, changes: { dog?: DogId; name?: string }): boolean {
    let changed = false;
    if (changes.dog) changed = this.db.prepare('UPDATE players SET dog = ? WHERE id = ?').run(changes.dog, id).changes > 0;
    if (changes.name) changed = this.db.prepare('UPDATE players SET name = ? WHERE id = ?').run(changes.name.trim(), id).changes > 0;
    return changed;
  }

  addRun(run: RunRecord): void {
    this.db
      .prepare('INSERT INTO runs (player_id, season, day, gingerbread, hearts, score, test) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(run.playerId, run.season, run.day, run.gingerbread, run.hearts, run.score, run.test ? 1 : 0);
  }

  /** The player's best score per day in the season, from real or from test runs. */
  bestScores(playerId: string, season: number, test = false): Map<number, number> {
    const rows = this.db
      .prepare('SELECT day, MAX(score) AS best FROM runs WHERE player_id = ? AND season = ? AND test = ? GROUP BY day')
      .all(playerId, season, test ? 1 : 0) as { day: number; best: number }[];
    return new Map(rows.map((r) => [r.day, r.best]));
  }

  /** Every player's best score on the day, highest first, from real or from test runs. */
  leaderboard(season: number, day: number, test = false): LeaderboardEntry[] {
    return this.db
      .prepare(
        `SELECT p.name AS name, p.dog AS dog, MAX(r.score) AS score
         FROM runs r JOIN players p ON p.id = r.player_id
         WHERE r.season = ? AND r.day = ? AND r.test = ?
         GROUP BY r.player_id
         ORDER BY score DESC, p.name ASC`,
      )
      .all(season, day, test ? 1 : 0) as unknown as LeaderboardEntry[];
  }
}

function newPin(): string {
  return String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, '0');
}
