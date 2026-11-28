// Every released level, by December day. A door is released when its level is
// listed here; the game and the server both read this list.

import { DOOR_ONE_SPEED } from '../constants.ts';
import type { CourseLayout } from '../course.ts';
import { door1, door2, door3, door4, door5, door6, door7 } from './week1.ts';
import { warmupCourse } from './warmup.ts';

/** A level's look beyond the course itself. */
export type Mood = 'christmas' | 'finnish';

export interface Level {
  day: number;
  /** Player-facing name of the level, without the day number. */
  name: string;
  /** Fixed scroll speed in pixels per second. */
  speed: number;
  build: () => CourseLayout;
  mood?: Mood;
}

/** Each door runs a little faster than the one before. */
const SPEED_STEP = 3;

export function doorSpeed(day: number): number {
  return DOOR_ONE_SPEED + SPEED_STEP * (day - 1);
}

const door = (day: number, name: string, build: () => CourseLayout, mood?: Mood): Level => ({
  day,
  name,
  speed: doorSpeed(day),
  build,
  mood,
});

export const LEVELS: readonly Level[] = [
  door(1, 'Joulurata', door1),
  door(2, 'Lumipallot', door2),
  door(3, 'Lumiukot', door3),
  door(4, 'Kuusikko', door4),
  door(5, 'Putket', door5),
  door(6, 'Itsenäisyyspäivä', door6, 'finnish'),
  door(7, 'Piparitalkoot', door7),
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
