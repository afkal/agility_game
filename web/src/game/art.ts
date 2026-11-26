// Shape-drawn art. Every picture except the dog is drawn here from simple
// shapes, so it can later be swapped for an image in one place.
//
// The rules use a y-up world with y = 0 at the middle of the view. Phaser
// draws y-down from the top, so world heights go through `sy` first.

import type Phaser from 'phaser';
import { GROUND_BOTTOM, GROUND_TOP, WORLD_HEIGHT } from '../../shared/constants.ts';
import { type AFrame, type Branch, type Table, aframeApex } from '../../shared/course.ts';
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
/** Pale, frosty green for the trees on the hills behind the course. */
const FROSTED_PINE = 0x5f9c83;

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

/** A snowman with a carrot nose, a red scarf and a top hat, standing on the course. */
export function drawSnowman(g: G, x: number, width: number, height: number): void {
  const cx = x + width / 2;
  const base = GROUND_TOP;
  const bottom = width * 0.48;
  const middle = width * 0.36;
  const head = width * 0.27;
  const middleY = base + 2 * bottom + middle * 0.6;
  const headY = base + height - head;
  g.fillStyle(SNOW_SHADE, 1);
  g.fillEllipse(cx, sy(base + 2), width * 1.2, 8);
  for (const [r, y] of [
    [bottom, base + bottom],
    [middle, middleY],
    [head, headY],
  ] as const) {
    circle(g, SNOW_WHITE, cx, y, r);
    g.lineStyle(1.5, SNOW_SHADE, 1);
    g.strokeCircle(cx, sy(y), r);
  }
  g.lineStyle(0, 0, 0);
  // Coal buttons and eyes.
  for (const dy of [-6, 4]) circle(g, 0x2b2b33, cx, middleY + dy, 2.2);
  for (const dx of [-4, 4]) circle(g, 0x2b2b33, cx + dx, headY + 3, 1.8);
  // A carrot nose pointing at the oncoming dog.
  triangle(g, 0xf28c28, cx - 1, headY + 1, cx - 1, headY - 3, cx - 14, headY - 1);
  // Red scarf with a loose end.
  rect(g, CANDY_RED, cx - head - 1, headY - head - 4, cx + head + 1, headY - head + 2);
  rect(g, CANDY_RED, cx + 2, headY - head - 14, cx + 8, headY - head - 2);
  // Top hat.
  rect(g, 0x2b2b33, cx - head - 3, headY + head - 3, cx + head + 3, headY + head + 1);
  rect(g, 0x2b2b33, cx - head * 0.7, headY + head, cx + head * 0.7, headY + head + 14);
  rect(g, CANDY_RED, cx - head * 0.7, headY + head + 1, cx + head * 0.7, headY + head + 4);
}

/** A snowy spruce branch in the air, with a few baubles hanging under it. */
export function drawBranch(g: G, b: Branch): void {
  rect(g, TRUNK, b.x0 - 6, b.top - 14, b.x1, b.top - 6);
  g.fillStyle(PINE_GREEN, 1);
  for (let x = b.x0 + 6; x < b.x1; x += 22) {
    g.fillEllipse(x, sy(b.top - 12), 34, 20);
  }
  g.fillStyle(DARK_PINE, 1);
  for (let x = b.x0 + 17; x < b.x1 - 6; x += 22) {
    g.fillEllipse(x, sy(b.top - 18), 22, 12);
  }
  g.fillStyle(SNOW_WHITE, 1);
  g.fillRoundedRect(b.x0 - 8, sy(b.top + 3), b.x1 - b.x0 + 14, 9, 4.5);
  const colors = [CANDY_RED, GOLD, CANDY_RED];
  const step = (b.x1 - b.x0) / (colors.length + 1);
  colors.forEach((color, i) => {
    const x = b.x0 + step * (i + 1);
    rect(g, 0x8a8a8a, x - 0.75, b.top - 27, x + 0.75, b.top - 18);
    circle(g, color, x, b.top - 31, 6);
  });
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

/**
 * A spruce. `snowy` ones, for the hills behind the course, are paler and
 * heavy with snow, so the dog and the obstacles stand out in front of them.
 */
export function drawPine(g: G, x: number, baseY: number, height: number, snowy = false): void {
  const w = height * 0.45;
  rect(g, TRUNK, x - w * 0.09, baseY, x + w * 0.09, baseY + height * 0.2);
  [1, 0.78, 0.55].forEach((scale, i) => {
    const y0 = baseY + height * (0.15 + i * 0.22);
    const half = w * scale;
    const top = y0 + height * 0.42;
    triangle(g, snowy ? FROSTED_PINE : DARK_PINE, x - half, y0, x + half, y0, x, top);
    if (snowy) {
      // Snow over the upper half of each tier and a fringe along its bottom.
      triangle(g, SNOW_WHITE, x - half * 0.6, y0 + height * 0.17, x + half * 0.6, y0 + height * 0.17, x, top);
      g.fillStyle(SNOW_WHITE, 1);
      for (let k = -2; k <= 2; k++) g.fillEllipse(x + (half * k) / 2.6, sy(y0 + 2), half * 0.42, 7);
    } else {
      triangle(g, SNOW_WHITE, x - half * 0.35, y0 + height * 0.28, x + half * 0.35, y0 + height * 0.28, x, top);
    }
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
  // A blue-grey rim and a shaded lower side, so the ball stands out against the snowy ground.
  g.fillStyle(0x7f9cc4, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(0xb9cde6, 1);
  g.fillCircle(cx, cy, r - 2.5);
  g.fillStyle(SNOW_WHITE, 1);
  g.fillCircle(cx - r * 0.12, cy - r * 0.14, r * 0.78);
  g.fillStyle(0x9fb8d6, 1);
  g.fillCircle(cx + r * 0.45, cy + r * 0.1, r * 0.11);
  g.fillCircle(cx - r * 0.3, cy + r * 0.45, r * 0.09);
  g.fillCircle(cx + r * 0.05, cy - r * 0.45, r * 0.07);
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
      drawPine(g, dx, -220, h, true);
    }
  } else {
    g.fillStyle(0xd6e8fa, 1);
    g.fillEllipse(0, sy(-260), 640, 340);
  }
}
