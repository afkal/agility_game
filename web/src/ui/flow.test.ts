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
  it('tells a test-mode save apart from a real one', async () => {
    const test = resultSaver({ postRun: async () => ({ saved: true, test: true }) }, 'p1');
    expect(await test(run)).toEqual({ status: 'saved-test' });
    const real = resultSaver({ postRun: async () => ({ saved: true, test: false }) }, 'p1');
    expect(await real(run)).toEqual({ status: 'saved' });
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
    );
    expect(await save(run)).toEqual({ status: 'failed' });
    fail = false;
    expect(await save(run)).toEqual({ status: 'saved' });
    expect(posted).toEqual([
      { playerId: 'p1', day: 1, gingerbread: 23, hearts: 2 },
      { playerId: 'p1', day: 1, gingerbread: 23, hearts: 2 },
    ]);
  });
});
