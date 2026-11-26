import { describe, expect, it } from 'vitest';
import { type DoorState, doorStates, helsinkiDate, seasonOf } from './calendar.ts';

const released = (...days: number[]) => new Set(days);
const dec = (day: number, year = 2026) => ({ year, month: 12, day });

function open(states: DoorState[]): number[] {
  return states.flatMap((s, i) => (s === 'open' ? [i + 1] : []));
}

describe('door states', () => {
  it('opens doors up to today and keeps the rest closed', () => {
    const states = doorStates(dec(3), released(1, 2, 3));
    expect(open(states)).toEqual([1, 2, 3]);
    expect(states.slice(3).every((s) => s === 'closed')).toBe(true);
  });

  it('shows a door whose day has come but whose level is not released as coming soon', () => {
    const states = doorStates(dec(5), released(1, 2, 3, 4));
    expect(states[4]).toBe('coming-soon');
    expect(states[5]).toBe('closed');
  });

  it('keeps every door closed before the first season', () => {
    const states = doorStates({ year: 2026, month: 11, day: 30 }, released(1));
    expect(states.every((s) => s === 'closed')).toBe(true);
  });

  it('opens every released door from 25 December', () => {
    const states = doorStates(dec(26), released(1, 2, 24));
    expect(open(states)).toEqual([1, 2, 24]);
    expect(states[2]).toBe('coming-soon');
  });

  it('keeps the doors open after New Year', () => {
    expect(open(doorStates({ year: 2027, month: 1, day: 2 }, released(1, 2)))).toEqual([1, 2]);
  });

  it('opens every released door in test mode', () => {
    const states = doorStates(dec(2), released(1, 5), true);
    expect(open(states)).toEqual([1, 5]);
    expect(states[1]).toBe('closed');
  });
});

describe('seasons and dates', () => {
  it('puts January to November in the previous December', () => {
    expect(seasonOf(dec(1))).toBe(2026);
    expect(seasonOf({ year: 2027, month: 1, day: 2 })).toBe(2026);
    expect(seasonOf({ year: 2027, month: 11, day: 30 })).toBe(2026);
    expect(seasonOf(dec(1, 2027))).toBe(2027);
    expect(seasonOf({ year: 2026, month: 11, day: 30 })).toBeNull();
  });

  it('uses the Finnish date, not UTC', () => {
    // 22:30 UTC on 30 November is already 1 December in Finland.
    expect(helsinkiDate(new Date('2026-11-30T22:30:00Z'))).toEqual(dec(1));
  });
});
