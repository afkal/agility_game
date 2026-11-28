import { describe, expect, it } from 'vitest';
import { type Body, type Ramp, type Solid, bodyBox, rampHeightAt, step } from './physics.ts';

const GRAVITY = 1875;
const DT = 1 / 60;
const HALF = { x: 36, y: 34 };

const ground: Solid = { kind: 'box', box: { min: { x: -10_000, y: -400 }, max: { x: 10_000, y: -300 } } };

function box(minX: number, minY: number, maxX: number, maxY: number): Solid {
  return { kind: 'box', box: { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } } };
}

function standingAt(x: number, surface: number): Body {
  return { center: { x, y: surface + HALF.y }, half: { ...HALF }, velocity: { x: 0, y: 0 }, grounded: true };
}

const bottom = (body: Body) => body.center.y - body.half.y;

function simulate(body: Body, solids: Solid[], seconds: number): boolean {
  let blocked = false;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    blocked = step(body, solids, GRAVITY, DT).blocked || blocked;
  }
  return blocked;
}

describe('physics step', () => {
  it('keeps a standing body on the ground', () => {
    const body = standingAt(0, -300);
    simulate(body, [ground], 1);
    expect(body.grounded).toBe(true);
    expect(bottom(body)).toBeCloseTo(-300, 2);
  });

  it('makes a jump rise, peak and land back on the ground', () => {
    const body = standingAt(0, -300);
    body.velocity.y = 750;
    let peak = bottom(body);
    for (let i = 0; i < 120; i++) {
      step(body, [ground], GRAVITY, DT);
      peak = Math.max(peak, bottom(body));
    }
    expect(peak).toBeGreaterThan(-300 + 140);
    expect(body.grounded).toBe(true);
    expect(bottom(body)).toBeCloseTo(-300, 2);
  });

  it('lands a jump towards a higher table on its top', () => {
    const body = standingAt(0, -300);
    body.velocity = { x: 200, y: 750 };
    simulate(body, [ground, box(100, -300, 400, -210)], 1);
    expect(body.grounded).toBe(true);
    expect(bottom(body)).toBeCloseTo(-210, 2);
  });

  it('stops a body running into a hurdle at its left side', () => {
    const body = standingAt(0, -300);
    body.velocity.x = 200;
    const blocked = simulate(body, [ground, box(100, -300, 116, -255)], 1);
    expect(blocked).toBe(true);
    expect(bodyBox(body).max.x).toBeCloseTo(100, 2);
  });

  it('clears a hurdle with a jump', () => {
    const body = standingAt(0, -300);
    body.velocity = { x: 200, y: 750 };
    const blocked = simulate(body, [ground, box(100, -300, 116, -255)], 1);
    expect(blocked).toBe(false);
    expect(bodyBox(body).min.x).toBeGreaterThan(116);
  });

  it('follows a ramp upwards and stays on the top', () => {
    const up: Ramp = { start: { x: 100, y: -300 }, end: { x: 400, y: -150 } };
    const solids: Solid[] = [ground, { kind: 'ramp', ramp: up }, box(400, -300, 500, -150)];
    const body = standingAt(0, -300);
    body.velocity.x = 150;
    let wasOnSlope = false;
    for (let i = 0; i < 180; i++) {
      step(body, solids, GRAVITY, DT);
      const h = rampHeightAt(up, body.center.x);
      if (h !== null && body.center.x > 150 && body.center.x < 350) {
        expect(body.grounded).toBe(true);
        expect(Math.abs(bottom(body) - h)).toBeLessThan(0.5);
        wasOnSlope = true;
      }
    }
    expect(wasOnSlope).toBe(true);
    expect(body.grounded).toBe(true);
    expect(body.center.x).toBeGreaterThan(400);
    expect(Math.abs(bottom(body) + 150)).toBeLessThan(0.5);
  });

  it('reports the slope underfoot', () => {
    const up: Ramp = { start: { x: 100, y: -300 }, end: { x: 400, y: -150 } };
    expect(step(standingAt(0, -300), [ground], GRAVITY, DT).groundAngle).toBe(0);

    const onRamp = standingAt(250, rampHeightAt(up, 250)!);
    const angle = step(onRamp, [ground, { kind: 'ramp', ramp: up }], GRAVITY, DT).groundAngle;
    expect(angle).toBeCloseTo(Math.atan(0.5), 4);

    const jumping = standingAt(0, -300);
    jumping.velocity.y = 800;
    expect(step(jumping, [ground], GRAVITY, DT).groundAngle).toBeNull();
  });

  it('sticks to a ramp going down', () => {
    const down: Solid = { kind: 'ramp', ramp: { start: { x: 0, y: -150 }, end: { x: 300, y: -300 } } };
    const body = standingAt(10, -155);
    body.velocity.x = 150;
    for (let i = 0; i < 90; i++) {
      step(body, [ground, down], GRAVITY, DT);
      expect(body.grounded).toBe(true);
    }
  });

  it('starts falling after running off an edge', () => {
    const body = standingAt(0, -300);
    body.velocity.x = 200;
    simulate(body, [box(-500, -400, 50, -300)], 1);
    expect(body.grounded).toBe(false);
    expect(bottom(body)).toBeLessThan(-300);
  });

  it('does not pass through a hurdle during long clamped frames', () => {
    const body = standingAt(0, -300);
    body.velocity.x = 300;
    for (let i = 0; i < 30; i++) {
      step(body, [ground, box(40, -300, 56, -255)], GRAVITY, 1 / 30);
    }
    expect(bodyBox(body).max.x).toBeLessThanOrEqual(40.01);
  });
});
