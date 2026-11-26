// The dog: jumping, running with the scroll and catching up after a stop.

import {
  CATCH_UP_GAIN,
  COYOTE_TIME,
  DOG_HALF_SIZE,
  GRAVITY,
  HOME_FROM_LEFT_EDGE,
  JUMP_VELOCITY,
  MAX_CATCH_UP_SPEED,
  WORLD_WIDTH,
} from './constants.ts';
import { type Body, type Solid, type Vec2, step } from './physics.ts';

export interface Dog {
  body: Body;
  /** Time left in which a jump still counts as from the ground. */
  coyote: number;
  /** Time left in which a recent jump press is still waiting to fire. */
  jumpBuffer: number;
  /** The dog tried to run forward this frame and an obstacle stopped it. */
  blocked: boolean;
  /** Slope underfoot in radians, or null in the air. The picture tilts to it. */
  groundAngle: number | null;
}

export function dogStandingAt(feet: Vec2): Dog {
  return {
    body: {
      center: { x: feet.x, y: feet.y + DOG_HALF_SIZE.y },
      half: { x: DOG_HALF_SIZE.x, y: DOG_HALF_SIZE.y },
      velocity: { x: 0, y: 0 },
      grounded: true,
    },
    coyote: COYOTE_TIME,
    jumpBuffer: 0,
    blocked: false,
    groundAngle: 0,
  };
}

/** Left edge of the view whose centre is at world x `scroll`. */
export function leftEdge(scroll: number): number {
  return scroll - WORLD_WIDTH / 2;
}

export function rightEdge(scroll: number): number {
  return scroll + WORLD_WIDTH / 2;
}

/** Where the dog normally runs, in world x, for the view at `scroll`. */
export function homeX(scroll: number): number {
  return leftEdge(scroll) + HOME_FROM_LEFT_EDGE;
}

/** The scroll position that puts the dog's home at world `x`. */
export function scrollWithHomeAt(x: number): number {
  return x - HOME_FROM_LEFT_EDGE + WORLD_WIDTH / 2;
}

/**
 * Run, jump and collide for one frame. `scroll` is the view position after
 * this frame's scrolling, and `speed` the course speed.
 */
export function moveDog(dog: Dog, scroll: number, speed: number, solids: readonly Solid[], dt: number): void {
  // The view has already moved this frame, so `behind` includes this frame's
  // scroll distance. Never run past home: at home the dog keeps pace.
  const behind = homeX(scroll) - dog.body.center.x;
  const catchUp = Math.min(Math.max(behind * CATCH_UP_GAIN, 0), MAX_CATCH_UP_SPEED);
  const toHome = Math.max(behind / dt, 0);
  dog.body.velocity.x = Math.min(speed + catchUp, toHome);

  if (dog.jumpBuffer > 0 && (dog.body.grounded || dog.coyote > 0)) {
    dog.body.velocity.y = JUMP_VELOCITY;
    dog.body.grounded = false;
    dog.jumpBuffer = 0;
    dog.coyote = 0;
  }

  const outcome = step(dog.body, solids, GRAVITY, dt);
  dog.blocked = outcome.blocked;
  dog.groundAngle = outcome.groundAngle;

  dog.coyote = dog.body.grounded ? COYOTE_TIME : Math.max(dog.coyote - dt, 0);
  dog.jumpBuffer = Math.max(dog.jumpBuffer - dt, 0);
}
