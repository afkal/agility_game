// Shape-drawn art. Every picture except the dog is drawn here from simple
// shapes, so it can later be swapped for an image in one place.
//
// The rules use a y-up world with y = 0 at the middle of the view. Phaser
// draws y-down from the top, so world heights go through `sy` first.

import type Phaser from 'phaser';
import { GROUND_BOTTOM, GROUND_TOP, WORLD_HEIGHT } from '../../shared/constants.ts';
import { type AFrame, type Table, aframeApex } from '../../shared/course.ts';
import type { Aabb } from '../../shared/physics.ts';

export const SKY = 0x73adeb;
export const SNOW_WHITE = 0xf7faff;
export const SNOW_SHADE = 0xccdef5;
export const CANDY_RED = 0xd91f29;
export const PINE_GREEN = 0x1a7a40;
export const DARK_PINE = 0x0f572e;
export const GOLD = 0xfacc38;
export const GINGERBREAD = 0xbd6e30;
export const ICING = 0xfffaf0;
export const HEART_RED = 0xeb2e4d;
const ICE = 0x9edbf2;
const DEEP_WATER = 0x3d78b3;
const TRUNK = 0x6b4529;

type G = Phaser.GameObjects.Graphics;

/** Screen y for a world height. */
export function sy(worldY: number): number {
  return WORLD_HEIGHT / 2 - worldY;
}

function rect(g: G, color: number, x0: number, y0: number, x1: number, y1: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x0, sy(y1), x1 - x0, y1 - y0);
}

function circle(g: G, color: number, x: number, y: number, r: number): void {
  g.fillStyle(color, 1);
  g.fillCircle(x, sy(y), r);
}

function triangle(g: G, color: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  g.fillStyle(color, 1);
  g.fillTriangle(ax, sy(ay), bx, sy(by), cx, sy(cy));
}

/** Alternating red and white, for candy-cane stripes. */
export function candyStripe(i: number): number {
  return i % 2 === 0 ? CANDY_RED : SNOW_WHITE;
}

export function drawGround(g: G, x0: number, x1: number): void {
  rect(g, SNOW_WHITE, x0, GROUND_BOTTOM - 200, x1, GROUND_TOP);
  rect(g, SNOW_SHADE, x0, GROUND_BOTTOM - 200, x1, GROUND_TOP - (GROUND_TOP - GROUND_BOTTOM) * 0.45);
}

/** Icy water at the bottom of a gap. */
export function drawPond(g: G, x0: number, x1: number): void {
  rect(g, DEEP_WATER, x0, GROUND_BOTTOM - 200, x1, GROUND_TOP - 60);
  rect(g, ICE, x0, GROUND_TOP - 67, x1, GROUND_TOP - 53);
}

/** A candy-cane post with a gold knob and a green bow. */
export function drawHurdle(g: G, b: Aabb): void {
  const w = b.max.x - b.min.x;
  const stripes = 6;
  const h = (b.max.y - b.min.y) / stripes;
  for (let i = 0; i < stripes; i++) {
    rect(g, candyStripe(i), b.min.x, b.min.y + h * i, b.max.x, b.min.y + h * (i + 1));
  }
  const cx = b.min.x + w / 2;
  circle(g, GOLD, cx, b.max.y + 6, 8);
  g.fillStyle(PINE_GREEN, 1);
  for (const dx of [-9, 9]) g.fillEllipse(cx + dx, sy(b.max.y - 8), 16, 10);
}

/**
 * A standing candy cane with its hook, thicker and taller than a hurdle, so it
 * reads as something to keep clear of.
 */
export function drawCane(g: G, x: number, width: number, height: number): void {
  const hookRadius = width;
  const stemTop = GROUND_TOP + height - hookRadius;
  const stripes = 6;
  const h = (stemTop - GROUND_TOP) / stripes;
  for (let i = 0; i < stripes; i++) {
    rect(g, candyStripe(i), x, GROUND_TOP + h * i, x + width, GROUND_TOP + h * (i + 1));
  }
  // The hook bends forward over the top in alternating stripes.
  const cx = x + width / 2 + hookRadius;
  const cy = sy(stemTop);
  const segments = 4;
  for (let i = 0; i < segments; i++) {
    g.lineStyle(width, candyStripe(i + stripes), 1);
    g.beginPath();
    g.arc(cx, cy, hookRadius, Math.PI + (i * Math.PI) / segments, Math.PI + ((i + 1) * Math.PI) / segments);
    g.strokePath();
  }
  g.lineStyle(0, 0, 0);
}

/** A small flag for the progress count in the corner of the view. */
export function drawFlagIcon(g: G, x: number, y: number): void {
  g.fillStyle(TRUNK, 1);
  g.fillRect(x - 2, y - 20, 4, 40);
  g.fillStyle(GOLD, 1);
  g.fillTriangle(x + 2, y - 20, x + 2, y, x + 30, y - 10);
}

/** Agility tables are giant Christmas presents with snow on top. */
export function drawTable(g: G, t: Table): void {
  const cx = (t.x0 + t.x1) / 2;
  rect(g, CANDY_RED, t.x0, GROUND_TOP, t.x1, t.top);
  rect(g, GOLD, cx - 9, GROUND_TOP, cx + 9, t.top);
  rect(g, GOLD, t.x0, t.top - 29, t.x1, t.top - 15);
  rect(g, SNOW_WHITE, t.x0 - 4, t.top - 8, t.x1 + 4, t.top + 2);
  g.fillStyle(GOLD, 1);
  for (const dx of [-16, 16]) g.fillEllipse(cx + dx, sy(t.top + 7), 32, 18);
}

/** Candy-striped chevrons. */
export function drawAFrame(g: G, a: AFrame): void {
  const left = a.x0;
  const right = a.x0 + 2 * a.halfWidth;
  const apex = aframeApex(a);
  [CANDY_RED, SNOW_WHITE, CANDY_RED, SNOW_WHITE].forEach((color, i) => {
    const t = i * 0.22;
    const shrink = (right - left) * t * 0.5;
    triangle(g, color, left + shrink, GROUND_TOP, right - shrink, GROUND_TOP, apex.x, apex.y - a.height * t * 0.9);
  });
  circle(g, GOLD, apex.x, apex.y + 4, 10);
}

export function drawPine(g: G, x: number, baseY: number, height: number): void {
  const w = height * 0.45;
  rect(g, TRUNK, x - w * 0.09, baseY, x + w * 0.09, baseY + height * 0.2);
  [1, 0.78, 0.55].forEach((scale, i) => {
    const y0 = baseY + height * (0.15 + i * 0.22);
    const half = w * scale;
    triangle(g, DARK_PINE, x - half, y0, x + half, y0, x, y0 + height * 0.42);
    triangle(g, SNOW_WHITE, x - half * 0.35, y0 + height * 0.28, x + half * 0.35, y0 + height * 0.28, x, y0 + height * 0.42);
  });
}

/** Candy-cane gate posts, a banner, and a big tree with presents behind the line. */
export function drawFinish(g: G, x: number): void {
  const base = GROUND_TOP;
  drawPine(g, x + 330, base, 320);
  g.fillStyle(GOLD, 1);
  g.fillPoints(starPoints(x + 330, sy(base + 330), 18) as Phaser.Math.Vector2[], true);
  for (const [dx, w, h, color] of [
    [260, 50, 40, CANDY_RED],
    [400, 60, 50, PINE_GREEN],
    [330, 40, 30, GOLD],
  ] as const) {
    rect(g, color, x + dx - w / 2, base, x + dx + w / 2, base + h);
    rect(g, SNOW_WHITE, x + dx - 4, base, x + dx + 4, base + h);
  }
  for (const dx of [-110, 110]) {
    for (let i = 0; i < 10; i++) {
      rect(g, candyStripe(i), x + dx - 7, base + i * 22, x + dx + 7, base + (i + 1) * 22);
    }
  }
  rect(g, GOLD, x - 120, base + 208, x + 120, base + 242);
  rect(g, CANDY_RED, x - 114, base + 214, x + 114, base + 236);
}

function starPoints(cx: number, cy: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
}

/** A checkpoint flag on a little pole; gold once the dog has passed it. */
export function drawCheckpoint(g: G, x: number, reached: boolean): void {
  g.clear();
  rect(g, TRUNK, x - 3, GROUND_TOP, x + 3, GROUND_TOP + 90);
  triangle(g, reached ? GOLD : PINE_GREEN, x + 3, GROUND_TOP + 88, x + 3, GROUND_TOP + 58, x + 45, GROUND_TOP + 73);
}

/**
 * A little gingerbread man of the given height, centred on (0, 0) in screen
 * coordinates, for drawing into a container.
 */
export function drawGingerbreadMan(g: G, height: number, cx = 0, cy = 0): void {
  const s = height / 40;
  g.fillStyle(GINGERBREAD, 1);
  g.fillCircle(cx, cy - 12 * s, 7 * s);
  g.fillRoundedRect(cx - 7.5 * s, cy - 12 * s, 15 * s, 22 * s, 7 * s);
  g.fillRoundedRect(cx - 13 * s, cy - 7 * s, 26 * s, 6 * s, 3 * s);
  g.fillRoundedRect(cx - 8.5 * s, cy + 4 * s, 6.4 * s, 13 * s, 3 * s);
  g.fillRoundedRect(cx + 2.1 * s, cy + 4 * s, 6.4 * s, 13 * s, 3 * s);
  g.fillStyle(ICING, 1);
  for (const x of [-2.5, 2.5]) g.fillCircle(cx + x * s, cy - 13.5 * s, 1.2 * s);
  for (const y of [-2, 3]) g.fillCircle(cx, cy + y * s, 1.5 * s);
}

/** A snowball centred on (0, 0), with marks so the rolling shows. */
export function drawSnowball(g: G, r: number, cx = 0, cy = 0): void {
  g.fillStyle(SNOW_SHADE, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(SNOW_WHITE, 1);
  g.fillCircle(cx - 2, cy - 2, r * 0.85);
  g.fillStyle(SNOW_SHADE, 1);
  g.fillCircle(cx + r * 0.45, cy, 3);
  g.fillCircle(cx - r * 0.3, cy + r * 0.4, 2.5);
}

/** A heart centred on (0, 0). */
export function drawHeart(g: G, size: number, color: number, alpha = 1, cx = 0, cy = 0): void {
  const r = size * 0.3;
  g.fillStyle(color, alpha);
  g.fillCircle(cx - r * 0.72, cy - r * 0.35, r);
  g.fillCircle(cx + r * 0.72, cy - r * 0.35, r);
  g.fillTriangle(cx - r * 1.6, cy - r * 0.1, cx + r * 1.6, cy - r * 0.1, cx, cy + r * 1.75);
}

/** Far hills and nearer hills with pines, drawn for one backdrop tile. */
export function drawHill(g: G, near: boolean): void {
  if (near) {
    g.fillStyle(0xe8f2ff, 1);
    g.fillEllipse(0, sy(-290), 520, 240);
    for (const [dx, h] of [
      [-90, 90],
      [-30, 120],
      [60, 100],
    ] as const) {
      drawPine(g, dx, -220, h);
    }
  } else {
    g.fillStyle(0xd6e8fa, 1);
    g.fillEllipse(0, sy(-260), 640, 340);
  }
}
