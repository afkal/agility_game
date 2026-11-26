import { describe, expect, it } from 'vitest';
import { COOKIE_RADIUS, DOG_HALF_SIZE, GROUND_TOP, HURDLE_WIDTH } from './constants.ts';
import type { CourseLayout } from './course.ts';
import { update } from './game.ts';
import { score } from './score.ts';
import { FRAME, atDogHeight, flatCourse, runFor, runUntilHeartLost, startRun, tap } from './test-support.ts';

/** Flat ground with a gap at 600..720 and checkpoints at 100 and 300. */
function gapCourse(extra: Partial<CourseLayout> = {}): CourseLayout {
  return flatCourse(50_000, {
    ground: [
      [-1_000, 600],
      [720, 50_000],
    ],
    checkpoints: [100, 300],
    finishX: 40_000,
    ...extra,
  });
}

const hurdleCourse = () => flatCourse(50_000, { hurdles: [400] });
const snowballCourse = () => flatCourse(50_000, { snowballs: [900] });

describe('hearts and checkpoints', () => {
  it('costs a heart for a fall and respawns at the latest checkpoint', () => {
    const state = startRun(gapCourse());
    runUntilHeartLost(state, 6);
    expect(state.hearts).toBe(2);
    expect(Math.abs(state.dog.body.center.x - 300)).toBeLessThan(1);
    expect(state.dog.body.grounded).toBe(true);
  });

  it('keeps collected cookies when a heart is lost', () => {
    const state = startRun(gapCourse({ cookies: [atDogHeight(150), atDogHeight(250), atDogHeight(400)] }));
    runUntilHeartLost(state, 6);
    expect(state.hearts).toBe(2);
    expect(state.gingerbread).toBe(3);
  });

  it('costs a heart when blocked by a hurdle until the edge arrives', () => {
    const state = startRun(hurdleCourse());
    runFor(state, 2.5);
    expect(state.dog.blocked).toBe(true);
    expect(state.hearts).toBe(3);
    runUntilHeartLost(state, 6);
    expect(state.hearts).toBe(2);
    // No checkpoint passed: back to the start.
    expect(Math.abs(state.dog.body.center.x)).toBeLessThan(1);
  });

  it('costs nothing for touching a hurdle and then jumping over it', () => {
    const state = startRun(hurdleCourse());
    runFor(state, 2.5);
    expect(state.dog.blocked).toBe(true);
    tap(state);
    runFor(state, 3);
    expect(state.hearts).toBe(3);
    expect(state.dog.body.center.x).toBeGreaterThan(400 + HURDLE_WIDTH);
  });

  it('costs a heart for touching a rolling snowball', () => {
    const state = startRun(snowballCourse());
    runFor(state, 4);
    expect(state.hearts).toBe(2);
  });

  it('costs nothing for a snowball during the respawn grace', () => {
    const state = startRun(snowballCourse());
    state.grace = 100;
    runFor(state, 4);
    expect(state.hearts).toBe(3);
  });

  it('ends the run after the last heart and waits for the player', () => {
    const state = startRun(flatCourse(50_000, { snowballs: [900], cookies: [atDogHeight(300)] }));
    state.hearts = 1;
    runUntilHeartLost(state, 6);
    expect(state.events).toEqual(expect.arrayContaining(['heartLost', 'gameOver']));
    expect(state.phase).toBe('over');
    expect(state.hearts).toBe(0);
    const x = state.dog.body.center.x;
    runFor(state, 1);
    expect(state.dog.body.center.x).toBe(x);
  });

  it('costs a heart for touching a candy cane', () => {
    const state = startRun(flatCourse(50_000, { canes: [400] }));
    runUntilHeartLost(state, 4);
    expect(state.hearts).toBe(2);
  });

  it('costs nothing for jumping clear over a candy cane', () => {
    const state = startRun(flatCourse(50_000, { canes: [400] }));
    // Take off so the dog is at the top of its jump over the cane.
    const takeOff = 400 - DOG_HALF_SIZE.x - 60;
    while (state.dog.body.center.x < takeOff) update(state, { jump: false }, FRAME);
    tap(state);
    runFor(state, 3);
    expect(state.hearts).toBe(3);
    expect(state.dog.body.center.x).toBeGreaterThan(400);
  });

  it('brings the snowball back when retrying from a checkpoint', () => {
    const state = startRun(flatCourse(50_000, { checkpoints: [100], snowballs: [1_400] }));
    runUntilHeartLost(state, 8);
    expect(state.hearts).toBe(2);
    expect(state.snowballs).toHaveLength(0);
    runFor(state, 2);
    expect(state.snowballs).toHaveLength(1);
  });

  it('respawns at the start when no checkpoint was passed', () => {
    const state = startRun(
      flatCourse(50_000, {
        ground: [
          [-1_000, 200],
          [320, 50_000],
        ],
        finishX: 40_000,
      }),
    );
    runUntilHeartLost(state, 6);
    expect(state.hearts).toBe(2);
    expect(Math.abs(state.dog.body.center.x)).toBeLessThan(1);
  });
});

describe('cookies and the finish', () => {
  it('collects a cookie it runs into once', () => {
    const state = startRun(flatCourse(50_000, { cookies: [atDogHeight(300)] }));
    runFor(state, 2);
    expect(state.gingerbread).toBe(1);
    expect(state.cookies[0]!.taken).toBe(true);
    runFor(state, 1);
    expect(state.gingerbread).toBe(1);
  });

  it('does not collect a cookie high above without a jump', () => {
    const y = GROUND_TOP + 2 * DOG_HALF_SIZE.y + COOKIE_RADIUS + 10;
    const state = startRun(flatCourse(50_000, { cookies: [{ x: 300, y }] }));
    runFor(state, 3);
    expect(state.gingerbread).toBe(0);
  });

  it('stops the run at the finish with the count', () => {
    const cookies = Array.from({ length: 23 }, (_, i) => atDogHeight(200 + i * 40));
    const state = startRun(flatCourse(50_000, { cookies, finishX: 1_500 }));
    for (let t = 0; state.phase !== 'finished'; t += FRAME) {
      expect(t).toBeLessThan(30);
      update(state, { jump: false }, FRAME);
    }
    expect(state.gingerbread).toBe(23);
    const { scroll } = state;
    const x = state.dog.body.center.x;
    runFor(state, 1);
    expect(state.scroll).toBe(scroll);
    expect(state.dog.body.center.x).toBe(x);
  });

  it('scores 23 cookies and 2 hearts as 330', () => {
    expect(score(23, 2)).toBe(330);
    expect(score(0, 1)).toBe(50);
  });
});
