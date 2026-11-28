// Layout checks that prove every released level can be completed at its own
// fixed speed.

import { describe, expect, it } from 'vitest';
import { AIR_JUMP_VELOCITY, SNOWMAN_HEIGHT, SNOWMAN_WIDTH, COOKIE_RADIUS, DOG_HALF_SIZE, GRAVITY, GROUND_TOP, HURDLE_HEIGHT, HURDLE_WIDTH, JUMP_VELOCITY } from '../constants.ts';
import { gapsOf, solidsOf, surfaceAt } from '../course.ts';
import { aabbFromCenter, overlaps } from '../physics.ts';
import { LEVELS, WARMUP } from './registry.ts';

/** Extra room kept on every jump so courses are comfortable, not exact. */
const MARGIN = 20;
const airtime = 2 * JUMP_VELOCITY / GRAVITY;
const jumpHeight = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
const airJumpHeight = (AIR_JUMP_VELOCITY * AIR_JUMP_VELOCITY) / (2 * GRAVITY);

/** How long the dog's feet stay above `height` during a jump from the ground. */
function timeAbove(height: number): number {
  const disc = JUMP_VELOCITY * JUMP_VELOCITY - 2 * GRAVITY * height;
  return (2 * Math.sqrt(Math.max(disc, 0))) / GRAVITY;
}

describe.each([...LEVELS, WARMUP].map((level) => [level.day, level] as const))('level %i', (_day, level) => {
  const layout = level.build();

  it('has gaps the dog can fall into and jump over', () => {
    const dogWidth = 2 * DOG_HALF_SIZE.x;
    const reach = level.speed * airtime;
    for (const [a, b] of gapsOf(layout)) {
      const width = b - a;
      expect(width, `gap at ${a}`).toBeGreaterThan(dogWidth);
      expect(width, `gap at ${a}`).toBeLessThanOrEqual(reach + dogWidth - MARGIN);
    }
  });

  it('has hurdles the dog can clear', () => {
    const needed = HURDLE_WIDTH + 2 * DOG_HALF_SIZE.x + MARGIN;
    expect(level.speed * timeAbove(HURDLE_HEIGHT)).toBeGreaterThanOrEqual(needed);
  });

  it('has snowmen on flat ground that a jump clears', () => {
    const clearDistance = timeAbove(SNOWMAN_HEIGHT + MARGIN) * level.speed;
    for (const x of layout.snowmen) {
      expect(clearDistance, `snowman at ${x}`).toBeGreaterThan(2 * DOG_HALF_SIZE.x + SNOWMAN_WIDTH + MARGIN);
      for (const probe of [x - 150, x, x + SNOWMAN_WIDTH + 150]) {
        expect(surfaceAt(layout, probe), `snowman at ${x}`).toBe(GROUND_TOP);
      }
    }
  });

  it('has every step up lower than a jump', () => {
    for (const table of layout.tables) {
      // The surface just before the table is what the dog jumps from.
      const before = surfaceAt(layout, table.x0 - 1) ?? GROUND_TOP;
      expect(table.top - before, `table at ${table.x0}`).toBeLessThanOrEqual(jumpHeight - 2 * MARGIN);
    }
  });

  it('has checkpoints on solid ground clear of obstacles', () => {
    expect(layout.checkpoints.length).toBeGreaterThan(0);
    for (const x of layout.checkpoints) {
      for (const dx of [-DOG_HALF_SIZE.x, 0, DOG_HALF_SIZE.x]) {
        expect(surfaceAt(layout, x + dx), `checkpoint at ${x}`).toBe(GROUND_TOP);
      }
      for (const h of layout.hurdles) {
        expect(Math.abs(h - x), `checkpoint at ${x}`).toBeGreaterThan(150);
      }
    }
  });

  /** The highest place to stand under `x` that is below `y`, branches included. */
  const standBelow = (x: number, y: number) =>
    Math.max(
      surfaceAt(layout, x) ?? GROUND_TOP,
      ...layout.branches.filter((b) => x >= b.x0 && x <= b.x1 && b.top < y).map((b) => b.top),
    );

  it('has every branch within one jump of the ground or a lower branch', () => {
    for (const branch of layout.branches) {
      const from = Math.max(
        GROUND_TOP,
        ...layout.branches.filter((b) => b.top < branch.top && b.x1 >= branch.x0 - 200 && b.x0 <= branch.x1).map((b) => b.top),
      );
      expect(branch.top - from, `branch at ${branch.x0}`).toBeLessThanOrEqual(jumpHeight - MARGIN);
      // Room to run underneath.
      expect(branch.top - GROUND_TOP, `branch at ${branch.x0}`).toBeGreaterThan(2 * DOG_HALF_SIZE.y + MARGIN);
    }
  });

  it('has no cookie inside an obstacle or out of reach', () => {
    // A cookie may need the second jump, taken at the top of the first.
    const reachAboveSurface = jumpHeight + airJumpHeight + 2 * DOG_HALF_SIZE.y - MARGIN;
    const boxes = solidsOf(layout).flatMap((s) => (s.kind === 'box' ? [s.box] : []));
    for (const c of layout.cookies) {
      const cookieBox = aabbFromCenter(c, { x: COOKIE_RADIUS, y: COOKIE_RADIUS });
      expect(boxes.some((b) => overlaps(cookieBox, b)), `cookie at ${c.x},${c.y}`).toBe(false);
      const below = standBelow(c.x, c.y);
      expect(c.y - COOKIE_RADIUS - below, `cookie at ${c.x},${c.y}`).toBeLessThanOrEqual(reachAboveSurface);
    }
  });

  it('ends after every obstacle and lasts as long as planned', () => {
    const lastObstacle = Math.max(
      ...layout.hurdles,
      ...layout.snowmen,
      ...layout.tables.map((t) => t.x1),
      ...layout.aframes.map((a) => a.x0 + 2 * a.halfWidth),
      ...gapsOf(layout).map((g) => g[1]),
      ...layout.snowballs,
    );
    expect(layout.finishX).toBeGreaterThan(lastObstacle);
    const seconds = (layout.finishX - layout.startX) / level.speed;
    // Doors are a challenge of two to three minutes; the warm-up is a short practice.
    const [shortest, longest] = level === WARMUP ? [30, 90] : [120, 180];
    expect(seconds).toBeGreaterThanOrEqual(shortest);
    expect(seconds).toBeLessThanOrEqual(longest);
  });

  it('builds the same course every time', () => {
    expect(level.build()).toEqual(layout);
  });
});
