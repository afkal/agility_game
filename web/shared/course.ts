// Course layouts as data, the builder that lays them out, and the geometry
// queries the rules and the layout checks share.

import {
  SNOWMAN_HEIGHT,
  SNOWMAN_WIDTH,
  TUNNEL_HEIGHT,
  TUNNEL_INNER_HEIGHT,
  GROUND_BOTTOM,
  GROUND_TOP,
  HURDLE_HEIGHT,
  HURDLE_WIDTH,
  WORLD_WIDTH,
} from './constants.ts';
import { type Aabb, type Ramp, type Solid, type Vec2, rampHeightAt } from './physics.ts';

export interface Table {
  x0: number;
  x1: number;
  top: number;
}

export interface Tunnel {
  x0: number;
  x1: number;
}

export interface Branch {
  x0: number;
  x1: number;
  top: number;
}

export interface AFrame {
  x0: number;
  halfWidth: number;
  height: number;
}

/** Everything that makes up one course. */
export interface CourseLayout {
  /** Snowy ground runs as [from x, to x]. Spaces between runs are gaps. */
  ground: [number, number][];
  /** Left x of each candy-cane hurdle standing on the ground. */
  hurdles: number[];
  /** Left x of each snowman: no collision, but touching one costs a heart. */
  snowmen: number[];
  /** Snowy spruce branches in the air: land on them from above, pass under or jump up through them. */
  branches: Branch[];
  /** Tunnels the dog crawls through by itself, as long as it reaches the mouth on the ground. */
  tunnels: Tunnel[];
  tables: Table[];
  aframes: AFrame[];
  cookies: Vec2[];
  /** Checkpoint x positions, each on solid ground. */
  checkpoints: number[];
  /** Where each rolling snowball appears, as an x on the ground. */
  snowballs: number[];
  startX: number;
  finishX: number;
}

export function aframeApex(a: AFrame): Vec2 {
  return { x: a.x0 + a.halfWidth, y: GROUND_TOP + a.height };
}

export function aframeRamps(a: AFrame): [Ramp, Ramp] {
  const apex = aframeApex(a);
  return [
    { start: { x: a.x0, y: GROUND_TOP }, end: apex },
    { start: apex, end: { x: a.x0 + 2 * a.halfWidth, y: GROUND_TOP } },
  ];
}

export function groundBox(x0: number, x1: number): Aabb {
  return { min: { x: x0, y: GROUND_BOTTOM }, max: { x: x1, y: GROUND_TOP } };
}

export function hurdleBox(x: number): Aabb {
  return { min: { x, y: GROUND_TOP }, max: { x: x + HURDLE_WIDTH, y: GROUND_TOP + HURDLE_HEIGHT } };
}

export function snowmanBox(x: number): Aabb {
  return { min: { x, y: GROUND_TOP }, max: { x: x + SNOWMAN_WIDTH, y: GROUND_TOP + SNOWMAN_HEIGHT } };
}

/** The tunnel's solid roof: low enough that only a crawling dog fits under it. */
export function tunnelRoof(t: Tunnel): Aabb {
  return { min: { x: t.x0, y: GROUND_TOP + TUNNEL_INNER_HEIGHT }, max: { x: t.x1, y: GROUND_TOP + TUNNEL_HEIGHT } };
}

export function tableBox(table: Table): Aabb {
  return { min: { x: table.x0, y: GROUND_TOP }, max: { x: table.x1, y: table.top } };
}

export function solidsOf(layout: CourseLayout): Solid[] {
  const solids: Solid[] = [];
  for (const [x0, x1] of layout.ground) solids.push({ kind: 'box', box: groundBox(x0, x1) });
  for (const x of layout.hurdles) solids.push({ kind: 'box', box: hurdleBox(x) });
  for (const t of layout.tables) solids.push({ kind: 'box', box: tableBox(t) });
  for (const a of layout.aframes) {
    for (const ramp of aframeRamps(a)) solids.push({ kind: 'ramp', ramp });
  }
  for (const branch of layout.branches) solids.push({ kind: 'ledge', ledge: branch });
  for (const tunnel of layout.tunnels) solids.push({ kind: 'box', box: tunnelRoof(tunnel) });
  return solids;
}

/** Gaps between ground runs, as [from x, to x]. */
export function gapsOf(layout: CourseLayout): [number, number][] {
  const gaps: [number, number][] = [];
  for (let i = 1; i < layout.ground.length; i++) {
    const prev = layout.ground[i - 1]!;
    const next = layout.ground[i]!;
    if (next[0] > prev[1]) gaps.push([prev[1], next[0]]);
  }
  return gaps;
}

/**
 * Height of the highest walkable surface under `x` on the ground level, or
 * null over a gap. Branches in the air do not count: nothing respawns or rolls
 * on them.
 */
export function surfaceAt(layout: CourseLayout, x: number): number | null {
  let best: number | null = null;
  const consider = (h: number) => {
    best = best === null ? h : Math.max(best, h);
  };
  if (layout.ground.some(([a, b]) => x >= a && x <= b)) consider(GROUND_TOP);
  for (const t of layout.tables) {
    if (x >= t.x0 && x <= t.x1) consider(t.top);
  }
  for (const a of layout.aframes) {
    for (const ramp of aframeRamps(a)) {
      const h = rampHeightAt(ramp, x);
      if (h !== null) consider(h);
    }
  }
  return best;
}

/**
 * Cookies float this high above the surface they belong to, within reach of a
 * standing or lightly jumping dog.
 */
const COOKIE_LIFT = 60;

/** Some cookies on flat ground float this high, so the dog has to jump for them. */
const HIGH_COOKIE_LIFT = 150;

/** Sky cookies float above the top of a single jump, so they need the second jump. */
const SKY_COOKIE_LIFT = 290;

/** Lays a course out left to right from a cursor. */
export class Builder {
  x = -600;
  layout: CourseLayout = {
    ground: [],
    hurdles: [],
    snowmen: [],
    branches: [],
    tunnels: [],
    tables: [],
    aframes: [],
    cookies: [],
    checkpoints: [],
    snowballs: [],
    startX: 0,
    finishX: 0,
  };

  ground(length: number): void {
    const end = this.x + length;
    const last = this.layout.ground.at(-1);
    if (last && Math.abs(last[1] - this.x) < 0.01) {
      last[1] = end;
    } else {
      this.layout.ground.push([this.x, end]);
    }
    this.x = end;
  }

  cookie(x: number, y: number): void {
    this.layout.cookies.push({ x, y });
  }

  /**
   * Flat snowy ground, optionally with a row of cookies along it. Every third
   * cookie floats higher, out of reach without a jump.
   */
  flat(length: number, cookies: boolean): void {
    const start = this.x;
    if (cookies) {
      const count = Math.floor(length / 180);
      for (let i = 0; i < count; i++) {
        const x = start + 150 + i * 180;
        const lift = i % 3 === 1 ? HIGH_COOKIE_LIFT : COOKIE_LIFT;
        if (x < start + length - 100) this.cookie(x, GROUND_TOP + lift);
      }
    }
    this.ground(length);
  }

  /**
   * Two snowy spruce branches in the air: a low one to jump onto and a higher
   * one beyond it, with cookies up there that only a climb or a second jump
   * reaches. Running along the ground underneath is safe too.
   */
  branches(): void {
    const x0 = this.x + 150;
    const low: Branch = { x0, x1: x0 + 260, top: GROUND_TOP + 140 };
    const high: Branch = { x0: x0 + 340, x1: x0 + 600, top: GROUND_TOP + 260 };
    this.layout.branches.push(low, high);
    this.cookie(low.x0 + 130, low.top + COOKIE_LIFT);
    this.cookie(high.x0 + 70, high.top + COOKIE_LIFT);
    this.cookie(high.x0 + 190, high.top + COOKIE_LIFT);
    this.cookie(high.x0 + 130, GROUND_TOP + COOKIE_LIFT);
    this.ground(high.x1 - this.x + 300);
  }

  /** Flat ground with two cookies so high in the air that only a second jump reaches them. */
  skyCookies(length: number): void {
    const middle = this.x + length / 2;
    this.cookie(middle - 60, GROUND_TOP + SKY_COOKIE_LIFT);
    this.cookie(middle + 60, GROUND_TOP + SKY_COOKIE_LIFT);
    this.ground(length);
  }

  /**
   * Snowballs rolling in one after another, `gaps` apart. Close together a
   * single jump clears two; further apart each needs its own jump.
   */
  snowballs(gaps: number[]): void {
    let x = this.x + 900;
    this.layout.snowballs.push(x);
    for (const gap of gaps) {
      x += gap;
      this.layout.snowballs.push(x);
    }
    this.ground(x - this.x + 200);
  }

  /**
   * A tunnel the dog crawls through by itself. A jump onto it runs along the
   * top instead, where two cookies wait; one more waits past the far end.
   */
  tunnel(length = 360): void {
    const x0 = this.x + 250;
    const x1 = x0 + length;
    this.layout.tunnels.push({ x0, x1 });
    this.cookie(x0 + length / 3, GROUND_TOP + TUNNEL_HEIGHT + COOKIE_LIFT);
    this.cookie(x0 + (2 * length) / 3, GROUND_TOP + TUNNEL_HEIGHT + COOKIE_LIFT);
    this.cookie(x1 + 90, GROUND_TOP + COOKIE_LIFT);
    this.ground(x1 - this.x + 300);
  }

  /** A snowman to jump over, with a cookie above it for a clean jump. */
  snowman(): void {
    const x = this.x + 200;
    this.layout.snowmen.push(x);
    this.cookie(x + SNOWMAN_WIDTH / 2, GROUND_TOP + SNOWMAN_HEIGHT + 70);
    this.ground(400);
  }

  /** A hurdle with an arc of cookies over it that a clean jump collects. */
  hurdle(): void {
    const x = this.x + 200;
    this.layout.hurdles.push(x);
    const mid = x + HURDLE_WIDTH / 2;
    this.cookie(mid - 60, GROUND_TOP + 130);
    this.cookie(mid, GROUND_TOP + 170);
    this.cookie(mid + 60, GROUND_TOP + 130);
    this.ground(400);
  }

  /** A single agility table of the given length and height. */
  table(length: number, height: number): void {
    const x0 = this.x + 150;
    const x1 = x0 + length;
    const top = GROUND_TOP + height;
    this.layout.tables.push({ x0, x1, top });
    for (let x = x0 + 80; x < x1 - 60; x += 120) {
      this.cookie(x, top + COOKIE_LIFT);
    }
    this.ground(x1 - this.x + 250);
  }

  /** Two tables in a row, the second one higher: the dog climbs up. */
  stairs(low: number, high: number): void {
    const x0 = this.x + 150;
    const mid = x0 + 260;
    const x1 = mid + 320;
    this.layout.tables.push({ x0, x1: mid, top: GROUND_TOP + low });
    this.layout.tables.push({ x0: mid, x1, top: GROUND_TOP + high });
    this.cookie(x0 + 130, GROUND_TOP + low + COOKIE_LIFT);
    this.cookie(mid + 100, GROUND_TOP + high + COOKIE_LIFT);
    this.cookie(mid + 220, GROUND_TOP + high + COOKIE_LIFT);
    this.ground(x1 - this.x + 300);
  }

  /** A gap with a cookie over the middle at jump height. */
  gap(width: number): void {
    this.cookie(this.x + width / 2, GROUND_TOP + 120);
    this.x += width;
  }

  /** The A-frame, with a cookie waiting at the top. */
  aframe(): void {
    const aframe: AFrame = { x0: this.x + 150, halfWidth: 300, height: 150 };
    const apex = aframeApex(aframe);
    this.layout.aframes.push(aframe);
    this.cookie(apex.x, apex.y + COOKIE_LIFT);
    this.cookie(aframe.x0 + 150, GROUND_TOP + 75 + COOKIE_LIFT);
    this.cookie(apex.x + 150, GROUND_TOP + 75 + COOKIE_LIFT);
    this.ground(2 * aframe.halfWidth + 400);
  }

  /** A long clear run where a snowball comes rolling towards the dog. */
  snowball(): void {
    this.layout.snowballs.push(this.x + 900);
    this.ground(1_100);
  }

  checkpoint(): void {
    this.layout.checkpoints.push(this.x + 150);
    this.ground(300);
  }

  finish(): void {
    this.layout.finishX = this.x + 300;
    // Plenty of ground after the line so the view never runs off the end.
    this.ground(300 + WORLD_WIDTH * 1.5);
  }

  build(): CourseLayout {
    return this.layout;
  }
}
