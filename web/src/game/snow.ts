// Snowflakes drifting down over the whole view. Purely decorative.

import type Phaser from 'phaser';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/constants.ts';

const FLAKE_COUNT = 140;

/** Radius of the flake texture; smaller flakes scale it down. */
const FLAKE_TEXTURE_RADIUS = 4.5;

interface Flake {
  image: Phaser.GameObjects.Image;
  fallSpeed: number;
  sway: number;
  phase: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

export class Snow {
  private readonly flakes: Flake[];

  constructor(scene: Phaser.Scene) {
    if (!scene.textures.exists('flake')) {
      const g = scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(FLAKE_TEXTURE_RADIUS, FLAKE_TEXTURE_RADIUS, FLAKE_TEXTURE_RADIUS);
      g.generateTexture('flake', FLAKE_TEXTURE_RADIUS * 2, FLAKE_TEXTURE_RADIUS * 2);
      g.destroy();
    }
    this.flakes = Array.from({ length: FLAKE_COUNT }, () => {
      const size = random(1.5, FLAKE_TEXTURE_RADIUS);
      const image = scene.add
        .image(random(0, WORLD_WIDTH), random(0, WORLD_HEIGHT), 'flake')
        .setScale(size / FLAKE_TEXTURE_RADIUS)
        .setAlpha(random(0.55, 0.95))
        .setScrollFactor(0)
        .setDepth(30);
      return {
        image,
        fallSpeed: 25 + size * 14,
        sway: random(8, 22),
        phase: random(0, Math.PI * 2),
      };
    });
  }

  update(dt: number, elapsed: number): void {
    for (const { image, fallSpeed, sway, phase } of this.flakes) {
      image.y += fallSpeed * dt;
      image.x += Math.cos(elapsed * 0.8 + phase) * sway * dt;
      if (image.y > WORLD_HEIGHT + 10) {
        image.setPosition(random(0, WORLD_WIDTH), -10);
      }
    }
  }
}
