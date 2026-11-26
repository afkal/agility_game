// Kinematic movement and collision for the dog.
//
// The course is made of axis-aligned boxes (ground, tables, hurdles) and ramps
// (the two sides of the A-frame). Boxes block from every side; ramps are
// walkable surfaces only. Everything here is plain math, so it runs and is
// tested without a browser.

export interface Vec2 {
  x: number;
  y: number;
}

export interface Aabb {
  min: Vec2;
  max: Vec2;
}

/** A straight walkable slope between two points (`start.x < end.x`). */
export interface Ramp {
  start: Vec2;
  end: Vec2;
}

export type Solid = { kind: 'box'; box: Aabb } | { kind: 'ramp'; ramp: Ramp };

/** A moving body described by its centre and half extents. */
export interface Body {
  center: Vec2;
  half: Vec2;
  velocity: Vec2;
  grounded: boolean;
}

export interface StepOutcome {
  /** The body tried to move sideways and a box stopped it. */
  blocked: boolean;
  /**
   * Slope of the surface the body stands on, in radians (0 on flat ground,
   * positive uphill to the right), or null while airborne.
   */
  groundAngle: number | null;
}

/** Small tolerance so that touching surfaces do not count as overlapping. */
const EPSILON = 0.01;

/**
 * How far below the feet a grounded body still sticks to a downward ramp
 * instead of starting to fall.
 */
const RAMP_SNAP = 24;

/**
 * A grounded body steps up onto a box edge at most this high instead of being
 * blocked by it. This joins ramps smoothly to the boxes at their ends; hurdles
 * and tables are much taller and still block.
 */
const STEP_UP = 20;

export function aabbFromCenter(center: Vec2, half: Vec2): Aabb {
  return {
    min: { x: center.x - half.x, y: center.y - half.y },
    max: { x: center.x + half.x, y: center.y + half.y },
  };
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y;
}

/** Surface height of the ramp at `x`, or null outside it. */
export function rampHeightAt(ramp: Ramp, x: number): number | null {
  if (x < ramp.start.x || x > ramp.end.x) {
    return null;
  }
  const t = (x - ramp.start.x) / (ramp.end.x - ramp.start.x);
  return ramp.start.y + t * (ramp.end.y - ramp.start.y);
}

/** Slope of the ramp in radians, positive when it rises to the right. */
export function rampAngle(ramp: Ramp): number {
  return Math.atan2(ramp.end.y - ramp.start.y, ramp.end.x - ramp.start.x);
}

export function bodyBox(body: Body): Aabb {
  return aabbFromCenter(body.center, body.half);
}

/**
 * Move `body` by its velocity over `dt` seconds, applying `gravity` and
 * resolving collisions against `solids`. Horizontal movement is resolved first
 * (boxes block), then vertical (landing on boxes and ramps, bumping heads on
 * box undersides).
 */
export function step(body: Body, solids: readonly Solid[], gravity: number, dt: number): StepOutcome {
  const outcome: StepOutcome = { blocked: false, groundAngle: null };
  const wasGrounded = body.grounded;

  // Horizontal.
  const dx = body.velocity.x * dt;
  if (dx !== 0) {
    const current = bodyBox(body);
    let newX = body.center.x + dx;
    let stepUpTo: number | null = null;
    for (const solid of solids) {
      if (solid.kind !== 'box') continue;
      const b = solid.box;
      const verticalOverlap = current.min.y < b.max.y - EPSILON && current.max.y > b.min.y + EPSILON;
      if (!verticalOverlap) continue;
      const lowEdge = wasGrounded && b.max.y - current.min.y <= STEP_UP;
      const enteringFromLeft = dx > 0 && current.max.x <= b.min.x + EPSILON && newX + body.half.x > b.min.x;
      const enteringFromRight = dx < 0 && current.min.x >= b.max.x - EPSILON && newX - body.half.x < b.max.x;
      if (lowEdge && (enteringFromLeft || enteringFromRight)) {
        stepUpTo = stepUpTo === null ? b.max.y : Math.max(stepUpTo, b.max.y);
        continue;
      }
      if (enteringFromLeft) {
        newX = Math.min(newX, b.min.x - body.half.x);
        outcome.blocked = true;
      } else if (enteringFromRight) {
        newX = Math.max(newX, b.max.x + body.half.x);
        outcome.blocked = true;
      }
    }
    body.center.x = newX;
    if (stepUpTo !== null) {
      body.center.y = Math.max(body.center.y, stepUpTo + body.half.y);
    }
  }

  // Vertical.
  body.velocity.y -= gravity * dt;
  const current = bodyBox(body);
  const dy = body.velocity.y * dt;
  const newBottom = current.min.y + dy;
  // Highest surface landed on, with its slope angle.
  let landedOn: { height: number; angle: number } | null = null;
  let ceiling: number | null = null;
  const consider = (height: number, angle: number) => {
    if (landedOn === null || height > landedOn.height) {
      landedOn = { height, angle };
    }
  };

  for (const solid of solids) {
    if (solid.kind === 'box') {
      const b = solid.box;
      const horizontalOverlap = current.min.x < b.max.x - EPSILON && current.max.x > b.min.x + EPSILON;
      if (!horizontalOverlap) continue;
      if (body.velocity.y <= 0 && current.min.y >= b.max.y - EPSILON && newBottom <= b.max.y) {
        consider(b.max.y, 0);
      } else if (body.velocity.y > 0 && current.max.y <= b.min.y + EPSILON && current.max.y + dy > b.min.y) {
        ceiling = ceiling === null ? b.min.y : Math.min(ceiling, b.min.y);
      }
    } else {
      const surface = rampHeightAt(solid.ramp, body.center.x);
      if (surface === null || body.velocity.y > 0) continue;
      const tolerance = wasGrounded ? RAMP_SNAP : EPSILON;
      // Walking up the slope puts the feet slightly below the surface; allow
      // that as long as the feet were not far below it.
      const feetNearOrAbove = current.min.y >= surface - RAMP_SNAP;
      if (feetNearOrAbove && newBottom <= surface + tolerance) {
        consider(surface, rampAngle(solid.ramp));
      }
    }
  }

  const landed = landedOn as { height: number; angle: number } | null;
  if (landed !== null) {
    outcome.groundAngle = landed.angle;
    body.center.y = landed.height + body.half.y;
    body.velocity.y = 0;
    body.grounded = true;
  } else if (ceiling !== null) {
    body.center.y = ceiling - body.half.y;
    body.velocity.y = 0;
    body.grounded = false;
  } else {
    body.center.y += dy;
    body.grounded = false;
  }

  return outcome;
}
