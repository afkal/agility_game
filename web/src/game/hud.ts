// Hearts, the gingerbread count and the level's day, fixed on screen.

import type Phaser from 'phaser';
import { STARTING_HEARTS, WORLD_WIDTH } from '../../shared/constants.ts';
import * as art from './art.ts';

const FONT = 'FiraSans-Bold, sans-serif';

export class Hud {
  private readonly hearts: Phaser.GameObjects.Graphics;
  private readonly count: Phaser.GameObjects.Text;
  private shownHearts = -1;
  private pulse = 0;

  constructor(scene: Phaser.Scene, day: number, name: string) {
    this.hearts = scene.add.graphics().setScrollFactor(0).setDepth(40);
    scene.add.image(WORLD_WIDTH - 150, 44, 'cookie').setScrollFactor(0).setDepth(40).setScale(1.2);
    this.count = scene.add
      .text(WORLD_WIDTH - 118, 44, '0', { fontFamily: FONT, fontSize: '36px', color: '#ffffff' })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(40)
      .setShadow(2, 2, '#2c4a70', 4);
    scene.add
      .text(WORLD_WIDTH / 2, 40, `Luukku ${day} · ${name}`, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(40)
      .setShadow(2, 2, '#2c4a70', 4);
  }

  update(hearts: number, gingerbread: number, heartLost: boolean): void {
    this.count.setText(String(gingerbread));
    if (heartLost) this.pulse = 1;
    if (hearts !== this.shownHearts || this.pulse > 0) {
      this.shownHearts = hearts;
      this.pulse = Math.max(this.pulse - 0.05, 0);
      this.hearts.clear();
      for (let i = 0; i < STARTING_HEARTS; i++) {
        const full = i < hearts;
        // The heart just lost flashes before it fades to an outline colour.
        const color = full ? art.HEART_RED : this.pulse > 0 && i === hearts ? art.GOLD : 0xffffff;
        art.drawHeart(this.hearts, 40, color, full ? 1 : 0.45, 120 + i * 50, 46);
      }
    }
  }
}
