import { describe, expect, it } from 'vitest';
import type { RunPost } from '../api.ts';
import { doorDisplay, firstScreen, resultSaver } from './flow.ts';

const run = { day: 1, gingerbread: 23, hearts: 2, score: 330 };

describe('screen flow', () => {
  it('starts with registration without a remembered player, else the calendar', () => {
    expect(firstScreen(null)).toBe('register');
    expect(firstScreen('abc')).toBe('calendar');
  });

  it('shows a door this page has no level for as coming soon', () => {
    expect(doorDisplay('open', false)).toBe('coming-soon');
    expect(doorDisplay('open', true)).toBe('open');
    expect(doorDisplay('closed', false)).toBe('closed');
  });
});

describe('saving a finished run', () => {
  it('sends nothing in test mode', async () => {
    const posted: RunPost[] = [];
    const save = resultSaver({ postRun: async (r) => (posted.push(r), { saved: true }) }, 'p1', true);
    expect(await save(run)).toBe('not-saved');
    expect(posted).toEqual([]);
  });

  it('reports a failed post and sends the same run again on retry', async () => {
    const posted: RunPost[] = [];
    let fail = true;
    const save = resultSaver(
      {
        postRun: async (r) => {
          posted.push(r);
          if (fail) throw new Error('offline');
          return { saved: true };
        },
      },
      'p1',
      false,
    );
    expect(await save(run)).toBe('failed');
    fail = false;
    expect(await save(run)).toBe('saved');
    expect(posted).toEqual([
      { playerId: 'p1', day: 1, gingerbread: 23, hearts: 2 },
      { playerId: 'p1', day: 1, gingerbread: 23, hearts: 2 },
    ]);
  });
});
