// Every database query lives here, so the SQLite driver can be swapped in one
// place.

import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export interface Player {
  id: string;
  name: string;
  dog: string;
}

export interface LeaderboardEntry {
  name: string;
  dog: string;
  score: number;
}

export interface RunRecord {
  playerId: string;
  season: number;
  day: number;
  gingerbread: number;
  hearts: number;
  score: number;
}

/** The key a name is matched by: trimmed and lower-cased. */
export function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase('fi');
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        dog TEXT NOT NULL,
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
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS runs_by_level ON runs (season, day);
    `);
  }

  /** The player with this name, created with `dog` if new; an existing player switches to `dog`. */
  registerPlayer(name: string, dog: string): Player {
    const key = nameKey(name);
    const existing = this.db.prepare('SELECT id, name FROM players WHERE name_key = ?').get(key) as
      | { id: string; name: string }
      | undefined;
    if (existing) {
      this.setDog(existing.id, dog);
      return { id: existing.id, name: existing.name, dog };
    }
    const id = randomUUID();
    const trimmed = name.trim();
    this.db.prepare('INSERT INTO players (id, name, name_key, dog) VALUES (?, ?, ?, ?)').run(id, trimmed, key, dog);
    return { id, name: trimmed, dog };
  }

  getPlayer(id: string): Player | undefined {
    return this.db.prepare('SELECT id, name, dog FROM players WHERE id = ?').get(id) as Player | undefined;
  }

  setDog(id: string, dog: string): boolean {
    return this.db.prepare('UPDATE players SET dog = ? WHERE id = ?').run(dog, id).changes > 0;
  }

  addRun(run: RunRecord): void {
    this.db
      .prepare('INSERT INTO runs (player_id, season, day, gingerbread, hearts, score) VALUES (?, ?, ?, ?, ?, ?)')
      .run(run.playerId, run.season, run.day, run.gingerbread, run.hearts, run.score);
  }

  /** The player's best score per day in the season. */
  bestScores(playerId: string, season: number): Map<number, number> {
    const rows = this.db
      .prepare('SELECT day, MAX(score) AS best FROM runs WHERE player_id = ? AND season = ? GROUP BY day')
      .all(playerId, season) as { day: number; best: number }[];
    return new Map(rows.map((r) => [r.day, r.best]));
  }

  /** Every player's best score on the day, highest first. */
  leaderboard(season: number, day: number): LeaderboardEntry[] {
    return this.db
      .prepare(
        `SELECT p.name AS name, p.dog AS dog, MAX(r.score) AS score
         FROM runs r JOIN players p ON p.id = r.player_id
         WHERE r.season = ? AND r.day = ?
         GROUP BY r.player_id
         ORDER BY score DESC, p.name ASC`,
      )
      .all(season, day) as unknown as LeaderboardEntry[];
  }
}
