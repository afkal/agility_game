// Every released level, by December day. A door is released when its level is
// listed here; the game and the server both read this list.

import { DOOR_ONE_SPEED } from '../constants.ts';
import type { CourseLayout } from '../course.ts';
import { christmasCourse } from './christmas.ts';
import { warmupCourse } from './warmup.ts';

export interface Level {
  day: number;
  /** Player-facing name of the level, without the day number. */
  name: string;
  /** Fixed scroll speed in pixels per second. */
  speed: number;
  build: () => CourseLayout;
}

export const LEVELS: readonly Level[] = [
  { day: 1, name: 'Joulurata', speed: DOOR_ONE_SPEED, build: christmasCourse },
];

/**
 * The warm-up course. It has day 0 so it shares the doors' saving and
 * leaderboards, but it is not a calendar door: it is always open and wins no
 * item.
 */
export const WARMUP: Level = { day: 0, name: 'Lämmittelyrata', speed: DOOR_ONE_SPEED, build: warmupCourse };

/** The level for a door, or the warm-up course for day 0. */
export function levelForDay(day: number): Level | undefined {
  return day === WARMUP.day ? WARMUP : LEVELS.find((level) => level.day === day);
}

const cookieCounts = new Map<number, number>();

/** How many cookies the level holds, for validating results. */
export function cookieCount(level: Level): number {
  let count = cookieCounts.get(level.day);
  if (count === undefined) {
    count = level.build().cookies.length;
    cookieCounts.set(level.day, count);
  }
  return count;
}
