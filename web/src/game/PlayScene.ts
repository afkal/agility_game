// The play scene: runs the rules every frame and draws their state. It owns
// no game rules of its own.

import Phaser from 'phaser';
import { COOKIE_RADIUS, SNOWBALL_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/constants.ts';
import { gapsOf, hurdleBox } from '../../shared/course.ts';
import { type GameState, newGame, update } from '../../shared/game.ts';
import type { Level } from '../../shared/levels/registry.ts';
import type { DogId } from '../../shared/profiles.ts';
import { leftEdge } from '../../shared/player.ts';
import * as art from './art.ts';
import { addWhiteDogTexture, dogLook } from './dogs.ts';
import { Hud } from './hud.ts';
import { Snow } from './snow.ts';

export interface PlaySceneOptions {
  level: Level;
  dogId: DogId;
  /** True while the run should stand still, such as with the phone upright. */
  isPaused: () => boolean;
  onFinish: (gingerbread: number, hearts: number) => void;
}

/** Course pictures are drawn in slices this wide, so only nearby ones render. */
const CHUNK = 1280;
/** The dog picture is square; its feet sit about a quarter of the way up. */
const DOG_PICTURE_SIZE = 150;
/** How quickly the picture turns towards the slope angle, per second. */
const TILT_RATE = 12;

interface Backdrop {
  container: Phaser.GameObjects.Container;
  baseX: number;
  depth: number;
  span: number;
}

export class PlayScene extends Phaser.Scene {
  private readonly options: PlaySceneOptions;
  private state!: GameState;
  private jumpQueued = false;
  private chunks: Phaser.GameObjects.Graphics[] = [];
  private checkpointFlags: Phaser.GameObjects.Graphics[] = [];
  private cookieImages: Phaser.GameObjects.Image[] = [];
  private snowballImages: Phaser.GameObjects.Image[] = [];
  private dog!: Phaser.GameObjects.Container;
  private dogPicture!: Phaser.GameObjects.Container;
  private tilt = 0;
  private backdrops: Backdrop[] = [];
  private hud!: Hud;
  private snow!: Snow;
  private confetti: { piece: Phaser.GameObjects.Rectangle; vx: number; vy: number; spin: number }[] = [];
  private elapsed = 0;

  constructor(options: PlaySceneOptions) {
    super({ key: 'play' });
    this.options = options;
  }

  preload(): void {
    this.load.image('dog-black', '/standing-right.png');
  }

  create(): void {
    addWhiteDogTexture(this);
    this.makeTextures();
    this.cameras.main.setBackgroundColor(art.SKY);
    this.state = newGame(this.options.level.build(), this.options.level.speed);

    this.createBackdrop();
    this.createCourse();
    this.createDog();
    this.snow = new Snow(this);
    this.hud = new Hud(this, this.options.level.day, this.options.level.name);

    this.input.on('pointerdown', () => {
      this.jumpQueued = true;
    });
    const keyboard = this.input.keyboard;
    if (keyboard) {
      keyboard.addCapture('SPACE');
      keyboard.on('keydown-SPACE', () => {
        this.jumpQueued = true;
      });
    }
  }

  /** Start the level again from the beginning. */
  restart(): void {
    this.state = newGame(this.state.layout, this.state.speed);
    for (const piece of this.confetti) piece.piece.destroy();
    this.confetti = [];
    this.jumpQueued = false;
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    this.snow.update(dt, this.elapsed);
    this.updateConfetti(dt);

    if (this.state.phase === 'playing' && !this.options.isPaused()) {
      update(this.state, { jump: this.jumpQueued }, dt);
      if (this.state.events.includes('finish')) {
        this.celebrate();
        this.options.onFinish(this.state.gingerbread, this.state.hearts);
      }
    }
    this.jumpQueued = false;
    this.render(dt);
  }

  private makeTextures(): void {
    const g = this.make.graphics({}, false);
    const cookie = COOKIE_RADIUS * 2.4;
    art.drawGingerbreadMan(g, cookie, cookie / 2 + 4, cookie / 2 + 4);
    g.generateTexture('cookie', cookie + 8, cookie + 8);
    g.clear();
    art.drawSnowball(g, SNOWBALL_RADIUS, SNOWBALL_RADIUS + 2, SNOWBALL_RADIUS + 2);
    g.generateTexture('snowball', SNOWBALL_RADIUS * 2 + 4, SNOWBALL_RADIUS * 2 + 4);
    g.destroy();
  }

  /** Background hills that scroll slower than the course and wrap around. */
  private createBackdrop(): void {
    const span = WORLD_WIDTH * 2;
    const layer = (count: number, depth: number, offset: number, near: boolean) => {
      for (let i = 0; i < count; i++) {
        const g = this.add.graphics();
        art.drawHill(g, near);
        const container = this.add.container(0, 0, [g]).setScrollFactor(0).setDepth(-100 + depth);
        this.backdrops.push({ container, baseX: (i * span) / count + offset, depth, span });
      }
    };
    layer(6, 0.15, 0, false);
    layer(5, 0.35, 120, true);
  }

  private createCourse(): void {
    const layout = this.state.layout;
    const end = layout.finishX + WORLD_WIDTH * 2;
    for (let x = layout.ground[0]![0]; x < end; x += CHUNK) {
      this.chunks.push(this.add.graphics().setDepth(1));
    }
    const chunkAt = (x: number) =>
      this.chunks[Math.min(this.chunks.length - 1, Math.max(0, Math.floor((x - layout.ground[0]![0]) / CHUNK)))]!;

    for (const [x0, x1] of layout.ground) {
      for (let x = x0; x < x1; x += CHUNK) art.drawGround(chunkAt(x), x, Math.min(x + CHUNK, x1));
    }
    for (const [x0, x1] of gapsOf(layout)) art.drawPond(chunkAt(x0), x0, x1);
    for (const x of layout.hurdles) art.drawHurdle(chunkAt(x), hurdleBox(x));
    for (const t of layout.tables) art.drawTable(chunkAt(t.x0), t);
    for (const a of layout.aframes) art.drawAFrame(chunkAt(a.x0), a);
    art.drawFinish(chunkAt(layout.finishX), layout.finishX);

    this.checkpointFlags = layout.checkpoints.map((x) => {
      const flag = this.add.graphics().setDepth(2);
      art.drawCheckpoint(flag, x, false);
      return flag;
    });
    this.cookieImages = layout.cookies.map((c) => this.add.image(c.x, art.sy(c.y), 'cookie').setDepth(5));
  }

  private createDog(): void {
    const look = dogLook(this.options.dogId);
    const picture = this.add.image(0, 0, look.texture).setDisplaySize(DOG_PICTURE_SIZE, DOG_PICTURE_SIZE);
    const extras = this.add.graphics();
    extras.fillStyle(look.scarf, 1);
    extras.fillRoundedRect(12, -22, 24, 9, 4);
    extras.fillTriangle(14, -18, 4, -6, 10, -4);
    const bx = 31;
    const by = -32;
    extras.fillStyle(art.CANDY_RED, 1);
    extras.fillTriangle(bx - 10, by, bx + 10, by - 1, bx - 15, by - 21);
    extras.fillStyle(art.SNOW_WHITE, 1);
    extras.fillRoundedRect(bx - 11.5, by - 3.5, 23, 7, 3.5);
    extras.fillCircle(bx - 16, by - 21, 4.5);
    this.dogPicture = this.add.container(0, -2, [picture, extras]);
    this.dog = this.add.container(0, 0, [this.dogPicture]).setDepth(10);
  }

  private render(dt: number): void {
    const { state } = this;
    const camera = this.cameras.main;
    camera.scrollX = leftEdge(state.scroll);
    camera.scrollY = 0;

    for (const b of this.backdrops) {
      const x = (((b.baseX - state.scroll * b.depth) % b.span) + b.span) % b.span;
      b.container.x = x - b.span / 2 + WORLD_WIDTH / 2;
    }
    const firstX = state.layout.ground[0]![0];
    this.chunks.forEach((g, i) => {
      const x0 = firstX + i * CHUNK;
      g.setVisible(x0 < camera.scrollX + WORLD_WIDTH + 600 && x0 + CHUNK > camera.scrollX - 600);
    });
    state.checkpointsReached.forEach((reached, i) => {
      const flag = this.checkpointFlags[i]!;
      if (flag.getData('reached') !== reached) {
        flag.setData('reached', reached);
        art.drawCheckpoint(flag, state.layout.checkpoints[i]!, reached);
      }
    });
    state.cookies.forEach((c, i) => {
      const image = this.cookieImages[i]!;
      image.setVisible(!c.taken);
      image.y = art.sy(c.y) + Math.sin(this.elapsed * 2.5 + c.x * 0.01) * 4;
    });

    while (this.snowballImages.length < state.snowballs.length) {
      this.snowballImages.push(this.add.image(0, 0, 'snowball').setDepth(6));
    }
    this.snowballImages.forEach((image, i) => {
      const ball = state.snowballs[i];
      image.setVisible(Boolean(ball));
      if (ball) image.setPosition(ball.x, art.sy(ball.y)).setRotation(-ball.rotation);
    });

    const body = state.dog.body;
    this.dog.setPosition(body.center.x, art.sy(body.center.y));
    const target = state.dog.groundAngle ?? 0;
    this.tilt += (target - this.tilt) * Math.min(dt * TILT_RATE, 1);
    this.dogPicture.setRotation(-this.tilt);
    this.dog.setAlpha(state.grace > 0 && Math.floor(this.elapsed * 8) % 2 === 0 ? 0.35 : 1);

    this.hud.update(state.hearts, state.gingerbread, state.events.includes('heartLost'));
  }

  /** Confetti in Christmas colours falling across the view. */
  private celebrate(): void {
    const colors = [art.CANDY_RED, art.GOLD, art.PINE_GREEN, art.SNOW_WHITE];
    for (let i = 0; i < 120; i++) {
      const piece = this.add
        .rectangle(Math.random() * WORLD_WIDTH, -20 - Math.random() * WORLD_HEIGHT * 0.6, 10, 6, colors[i % colors.length])
        .setScrollFactor(0)
        .setDepth(50);
      this.confetti.push({ piece, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, spin: (Math.random() - 0.5) * 8 });
    }
  }

  private updateConfetti(dt: number): void {
    for (const c of this.confetti) {
      c.piece.x += c.vx * dt;
      c.piece.y += c.vy * dt;
      c.piece.rotation += c.spin * dt;
      if (c.piece.y > WORLD_HEIGHT + 20) c.piece.y = -20;
    }
  }
}
