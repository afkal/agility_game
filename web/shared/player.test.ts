import { describe, expect, it } from 'vitest';
import { DOG_HALF_SIZE, GROUND_TOP } from './constants.ts';
import type { GameState } from './game.ts';
import { homeX } from './player.ts';
import { FRAME, flatCourse, runFor, startRun, tap } from './test-support.ts';

const bottom = (state: GameState) => state.dog.body.center.y - state.dog.body.half.y;

describe('the dog', () => {
  it('jumps on a tap and lands again', () => {
    const state = startRun(flatCourse(50_000));
    tap(state);
    runFor(state, 0.2);
    expect(bottom(state)).toBeGreaterThan(GROUND_TOP + 50);
    runFor(state, 1.5);
    expect(state.dog.body.grounded).toBe(true);
    expect(bottom(state)).toBeCloseTo(GROUND_TOP, 2);
  });

  it('runs with the scroll at its home position', () => {
    const state = startRun(flatCourse(50_000));
    runFor(state, 2);
    expect(Math.abs(state.dog.body.center.x - homeX(state.scroll))).toBeLessThan(2);
  });

  it('falls behind while blocked as the view moves on', () => {
    const state = startRun(flatCourse(50_000));
    const wallX = homeX(state.scroll) + 100;
    state.solids.push({
      kind: 'box',
      box: { min: { x: wallX, y: GROUND_TOP }, max: { x: wallX + 16, y: GROUND_TOP + 45 } },
    });
    runFor(state, 1.5);
    expect(state.dog.blocked).toBe(true);
    expect(state.dog.body.center.x + DOG_HALF_SIZE.x).toBeCloseTo(wallX, 2);
    expect(homeX(state.scroll)).toBeGreaterThan(state.dog.body.center.x + 100);
  });

  it('catches up faster than the scroll and stops at home', () => {
    const state = startRun(flatCourse(50_000));
    state.dog.body.center.x -= 300;
    const startGap = homeX(state.scroll) - state.dog.body.center.x;
    runFor(state, 0.25);
    expect(homeX(state.scroll) - state.dog.body.center.x).toBeLessThan(startGap - 20);
    runFor(state, 4);
    const home = homeX(state.scroll);
    expect(state.dog.body.center.x).toBeLessThanOrEqual(home + 0.5);
    expect(home - state.dog.body.center.x).toBeLessThan(2);
  });

  it('still jumps just after running off an edge', () => {
    const state = startRun(flatCourse(50_000));
    // Ground ends just behind the dog's back edge, so it steps off at once.
    const edge = homeX(state.scroll) + DOG_HALF_SIZE.x;
    state.solids = [
      { kind: 'box', box: { min: { x: -5_000, y: -400 }, max: { x: edge - 2 * DOG_HALF_SIZE.x + 3, y: GROUND_TOP } } },
    ];
    runFor(state, 2 * FRAME);
    expect(state.dog.body.grounded).toBe(false);
    tap(state);
    expect(state.dog.body.velocity.y).toBeGreaterThan(0);
  });

  it('fires a jump tapped just before landing on landing', () => {
    const state = startRun(flatCourse(50_000));
    // About 0.09 s of falling left, inside the jump buffer window.
    state.dog.body.center.y += 8;
    state.dog.body.grounded = false;
    state.dog.coyote = 0;
    tap(state);
    runFor(state, 0.15);
    expect(bottom(state)).toBeGreaterThan(GROUND_TOP + 20);
  });
});
