// One run of a level: the state the rules keep and the per-frame update that
// moves it on. The play scene draws from this state; tests drive it directly.

import {
  FALL_LIMIT,
  GROUND_TOP,
  JUMP_BUFFER_TIME,
  MAX_FRAME_DELTA,
  RESPAWN_GRACE,
  SNOWBALL_GRAVITY,
  SNOWBALL_HIT_SHRINK,
  SNOWBALL_RADIUS,
  SNOWBALL_SPEED,
  STARTING_HEARTS,
  CANE_HIT_SHRINK,
  COOKIE_RADIUS,
} from './constants.ts';
import { type CourseLayout, caneBox, solidsOf, surfaceAt } from './course.ts';
import { type Solid, aabbFromCenter, bodyBox, overlaps } from './physics.ts';
import { type Dog, dogStandingAt, leftEdge, moveDog, rightEdge, scrollWithHomeAt } from './player.ts';

export interface Snowball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Rolling angle in radians, for the picture. */
  rotation: number;
}

export interface Cookie {
  x: number;
  y: number;
  taken: boolean;
}

/** Something that happened during an update, for sounds and visual cues. */
export type GameEvent = 'cookie' | 'checkpoint' | 'heartLost' | 'gameOver' | 'finish';

export interface GameState {
  layout: CourseLayout;
  solids: Solid[];
  /** Fixed course speed in pixels per second. */
  speed: number;
  /** World x of the centre of the view. */
  scroll: number;
  dog: Dog;
  hearts: number;
  gingerbread: number;
  cookies: Cookie[];
  /** Whether the dog has passed each checkpoint, in layout order. */
  checkpointsReached: boolean[];
  /** X of the latest checkpoint passed, if any. */
  latestCheckpoint: number | null;
  /** Seconds of respawn protection left. */
  grace: number;
  /** Snowball start positions that have not rolled in yet. */
  pendingSnowballs: number[];
  snowballs: Snowball[];
  /** `over` once the last heart is lost; the player chooses whether to try again. */
  phase: 'playing' | 'finished' | 'over';
  /** Events from the latest update. */
  events: GameEvent[];
}

export interface GameInput {
  /** A tap or Space press since the previous update. */
  jump: boolean;
}

/** A fresh run of the course: three hearts, no cookies, dog at the start. */
export function newGame(layout: CourseLayout, speed: number): GameState {
  const startSurface = surfaceAt(layout, layout.startX) ?? GROUND_TOP;
  return {
    layout,
    solids: solidsOf(layout),
    speed,
    scroll: scrollWithHomeAt(layout.startX),
    dog: dogStandingAt({ x: layout.startX, y: startSurface }),
    hearts: STARTING_HEARTS,
    gingerbread: 0,
    cookies: layout.cookies.map((c) => ({ x: c.x, y: c.y, taken: false })),
    checkpointsReached: layout.checkpoints.map(() => false),
    latestCheckpoint: null,
    grace: 0,
    pendingSnowballs: [...layout.snowballs],
    snowballs: [],
    phase: 'playing',
    events: [],
  };
}

/** Advance the run by `rawDt` seconds. Does nothing once the run is finished or over. */
export function update(state: GameState, input: GameInput, rawDt: number): void {
  state.events = [];
  if (state.phase !== 'playing') return;
  const dt = Math.min(rawDt, MAX_FRAME_DELTA);
  if (dt <= 0) return;

  state.scroll += state.speed * dt;
  if (input.jump) state.dog.jumpBuffer = JUMP_BUFFER_TIME;
  moveDog(state.dog, state.scroll, state.speed, state.solids, dt);
  spawnDueSnowballs(state);
  moveSnowballs(state, dt);
  trackCheckpoints(state);
  if (checkHazards(state, dt)) return;
  collectCookies(state);
  checkFinish(state);
}

function spawnDueSnowballs(state: GameState): void {
  if (state.pendingSnowballs.length === 0) return;
  const due = rightEdge(state.scroll) + SNOWBALL_RADIUS * 2;
  state.pendingSnowballs = state.pendingSnowballs.filter((x) => {
    if (x > due) return true;
    state.snowballs.push({
      x,
      y: GROUND_TOP + SNOWBALL_RADIUS,
      vx: -SNOWBALL_SPEED,
      vy: 0,
      radius: SNOWBALL_RADIUS,
      rotation: 0,
    });
    return false;
  });
}

function moveSnowballs(state: GameState, dt: number): void {
  for (const ball of state.snowballs) {
    ball.x += ball.vx * dt;
    const restingHeight = GROUND_TOP + ball.radius;
    const onGround = surfaceAt(state.layout, ball.x) !== null && ball.y >= restingHeight - 0.01;
    if (onGround) {
      ball.vy = 0;
      ball.y = restingHeight;
    } else {
      ball.vy -= SNOWBALL_GRAVITY * dt;
      ball.y += ball.vy * dt;
    }
    ball.rotation += (ball.vx * dt) / ball.radius;
  }
  const gone = leftEdge(state.scroll) - 300;
  state.snowballs = state.snowballs.filter((b) => b.y >= FALL_LIMIT && b.x >= gone);
}

function trackCheckpoints(state: GameState): void {
  const { dog } = state;
  state.layout.checkpoints.forEach((x, i) => {
    if (state.checkpointsReached[i] || dog.body.center.x < x || !dog.body.grounded) return;
    state.checkpointsReached[i] = true;
    if (state.latestCheckpoint === null || x > state.latestCheckpoint) state.latestCheckpoint = x;
    state.events.push('checkpoint');
  });
}

/**
 * Lose a heart if the dog fell, got caught by the edge, hit a snowball or
 * touched a candy cane. Returns true when that was the last heart.
 */
function checkHazards(state: GameState, dt: number): boolean {
  state.grace = Math.max(state.grace - dt, 0);
  const dogBox = bodyBox(state.dog.body);
  const fell = state.dog.body.center.y < FALL_LIMIT;
  const protectedNow = state.grace > 0;
  const caughtByEdge = !protectedNow && dogBox.min.x < leftEdge(state.scroll);
  const hitSnowball =
    !protectedNow &&
    state.snowballs.some((ball) => {
      const half = ball.radius - SNOWBALL_HIT_SHRINK;
      return overlaps(aabbFromCenter({ x: ball.x, y: ball.y }, { x: half, y: half }), dogBox);
    });
  const hitCane =
    !protectedNow &&
    state.layout.canes.some((x) => {
      const box = caneBox(x);
      box.min.x += CANE_HIT_SHRINK;
      box.max.x -= CANE_HIT_SHRINK;
      return overlaps(box, dogBox);
    });
  if (!(fell || caughtByEdge || hitSnowball || hitCane)) return false;

  state.hearts = Math.max(state.hearts - 1, 0);
  if (state.hearts === 0) {
    state.phase = 'over';
    state.events.push('heartLost', 'gameOver');
    return true;
  }

  const x = state.latestCheckpoint ?? state.layout.startX;
  state.dog = dogStandingAt({ x, y: surfaceAt(state.layout, x) ?? GROUND_TOP });
  state.scroll = scrollWithHomeAt(x);
  // Every snowball still ahead of the view comes back, so retrying a stretch
  // from the checkpoint meets the same snowballs again.
  state.snowballs = [];
  const ahead = rightEdge(state.scroll);
  state.pendingSnowballs = state.layout.snowballs.filter((sx) => sx > ahead);
  state.grace = RESPAWN_GRACE;
  state.events.push('heartLost');
  return false;
}

function collectCookies(state: GameState): void {
  const dogBox = bodyBox(state.dog.body);
  for (const cookie of state.cookies) {
    if (cookie.taken) continue;
    const box = aabbFromCenter(cookie, { x: COOKIE_RADIUS, y: COOKIE_RADIUS });
    if (overlaps(box, dogBox)) {
      cookie.taken = true;
      state.gingerbread += 1;
      state.events.push('cookie');
    }
  }
}

function checkFinish(state: GameState): void {
  if (state.dog.body.center.x >= state.layout.finishX) {
    state.dog.jumpBuffer = 0;
    state.phase = 'finished';
    state.events.push('finish');
  }
}
