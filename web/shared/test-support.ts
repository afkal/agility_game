// Helpers for driving a run in tests: build simple courses and advance time
// in small frames, as the game loop does.

import { DOG_HALF_SIZE, GROUND_TOP } from './constants.ts';
import type { CourseLayout } from './course.ts';
import { type GameState, newGame, update } from './game.ts';
import type { Vec2 } from './physics.ts';

export const FRAME = 1 / 60;
export const TEST_SPEED = 200;

/** A plain flat course of the given length. */
export function flatCourse(length: number, extra: Partial<CourseLayout> = {}): CourseLayout {
  return {
    ground: [[-1_000, length]],
    hurdles: [],
    canes: [],
    tables: [],
    aframes: [],
    cookies: [],
    checkpoints: [],
    snowballs: [],
    startX: 0,
    finishX: length - 200,
    ...extra,
  };
}

export function startRun(layout: CourseLayout, speed = TEST_SPEED): GameState {
  return newGame(layout, speed);
}

/** One update with a tap. */
export function tap(state: GameState): void {
  update(state, { jump: true }, FRAME);
}

/** Updates of one frame each until `seconds` have passed. */
export function runFor(state: GameState, seconds: number): void {
  let remaining = seconds;
  while (remaining > 1e-6) {
    const dt = Math.min(remaining, FRAME);
    update(state, { jump: false }, dt);
    remaining -= dt;
  }
}

/** Step frame by frame until a heart is lost or the run restarts. */
export function runUntilHeartLost(state: GameState, maxSeconds: number): void {
  for (let t = 0; t < maxSeconds; t += FRAME) {
    update(state, { jump: false }, FRAME);
    if (state.events.includes('heartLost')) return;
  }
  throw new Error(`no heart lost within ${maxSeconds} s`);
}

export function atDogHeight(x: number): Vec2 {
  return { x, y: GROUND_TOP + DOG_HALF_SIZE.y };
}
