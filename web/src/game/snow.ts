// Snowflakes drifting down over the whole view. Purely decorative.

import type Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/constants.ts';

const FLAKE_COUNT = 140;

interface Flake {
  x: number;
  y: number;
  size: number;
  alpha: number;
  fallSpeed: number;
  sway: number;
  phase: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

export class Snow {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly flakes: Flake[];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(30);
    this.flakes = Array.from({ length: FLAKE_COUNT }, () => {
      const size = random(1.5, 4.5);
      return {
        x: random(0, WORLD_WIDTH),
        y: random(0, WORLD_HEIGHT),
        size,
        alpha: random(0.55, 0.95),
        // Bigger flakes are "closer" and fall faster.
        fallSpeed: 25 + size * 14,
        sway: random(8, 22),
        phase: random(0, Math.PI * 2),
      };
    });
  }

  update(dt: number, elapsed: number): void {
    const g = this.graphics;
    g.clear();
    for (const f of this.flakes) {
      f.y += f.fallSpeed * dt;
      f.x += Math.cos(elapsed * 0.8 + f.phase) * f.sway * dt;
      if (f.y > WORLD_HEIGHT + 10) {
        f.y = -10;
        f.x = random(0, WORLD_WIDTH);
      }
      g.fillStyle(0xffffff, f.alpha);
      g.fillCircle(f.x, f.y, f.size);
    }
  }
}
