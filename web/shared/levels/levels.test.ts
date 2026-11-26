// Layout checks that prove every released level can be completed at its own
// fixed speed.

import { describe, expect, it } from 'vitest';
import { COOKIE_RADIUS, DOG_HALF_SIZE, GRAVITY, GROUND_TOP, HURDLE_HEIGHT, HURDLE_WIDTH, JUMP_VELOCITY } from '../constants.ts';
import { gapsOf, solidsOf, surfaceAt } from '../course.ts';
import { aabbFromCenter, overlaps } from '../physics.ts';
import { LEVELS } from './registry.ts';

/** Extra room kept on every jump so courses are comfortable, not exact. */
const MARGIN = 20;
const airtime = 2 * JUMP_VELOCITY / GRAVITY;
const jumpHeight = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);

/** How long the dog's feet stay above `height` during a jump from the ground. */
function timeAbove(height: number): number {
  const disc = JUMP_VELOCITY * JUMP_VELOCITY - 2 * GRAVITY * height;
  return (2 * Math.sqrt(Math.max(disc, 0))) / GRAVITY;
}

describe.each(LEVELS.map((level) => [level.day, level] as const))('door %i', (_day, level) => {
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

  it('has no cookie inside an obstacle or out of reach', () => {
    const reachAboveSurface = jumpHeight + 2 * DOG_HALF_SIZE.y - MARGIN;
    const boxes = solidsOf(layout).flatMap((s) => (s.kind === 'box' ? [s.box] : []));
    for (const c of layout.cookies) {
      const cookieBox = aabbFromCenter(c, { x: COOKIE_RADIUS, y: COOKIE_RADIUS });
      expect(boxes.some((b) => overlaps(cookieBox, b)), `cookie at ${c.x},${c.y}`).toBe(false);
      const below = surfaceAt(layout, c.x) ?? GROUND_TOP;
      expect(c.y - COOKIE_RADIUS - below, `cookie at ${c.x},${c.y}`).toBeLessThanOrEqual(reachAboveSurface);
    }
  });

  it('ends after every obstacle and takes two to three minutes', () => {
    const lastObstacle = Math.max(
      ...layout.hurdles,
      ...layout.tables.map((t) => t.x1),
      ...layout.aframes.map((a) => a.x0 + 2 * a.halfWidth),
      ...gapsOf(layout).map((g) => g[1]),
      ...layout.snowballs,
    );
    expect(layout.finishX).toBeGreaterThan(lastObstacle);
    const seconds = (layout.finishX - layout.startX) / level.speed;
    expect(seconds).toBeGreaterThanOrEqual(120);
    expect(seconds).toBeLessThanOrEqual(180);
  });

  it('builds the same course every time', () => {
    expect(level.build()).toEqual(layout);
  });
});
