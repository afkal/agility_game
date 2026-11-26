// The play scene: runs the rules every frame and draws their state. It owns
// no game rules of its own.

import Phaser from 'phaser';
import { JUMP_VELOCITY, SNOWMAN_HEIGHT, SNOWMAN_WIDTH, COOKIE_RADIUS, SNOWBALL_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from '../../shared/constants.ts';
import { gapsOf, hurdleBox } from '../../shared/course.ts';
import { type GameState, newGame, update } from '../../shared/game.ts';
import type { Level } from '../../shared/levels/registry.ts';
import type { DogId } from '../../shared/profiles.ts';
import { leftEdge } from '../../shared/player.ts';
import * as art from './art.ts';
import { addWhiteDogTexture, dogLook, drawOutfit } from './dogs.ts';
import { type Outfit, outfitShapes } from '../../shared/wardrobe.ts';
import { Hud } from './hud.ts';
import { Snow } from './snow.ts';

export interface PlaySceneOptions {
  level: Level;
  dogId: DogId;
  /** What the dog wears. */
  outfit: Outfit;
  /** True while the run should stand still, such as with the phone upright. */
  isPaused: () => boolean;
  onFinish: (gingerbread: number, hearts: number) => void;
  /** The last heart is gone; the player decides whether to try again. */
  onGameOver: () => void;
}

/** Course pictures are drawn in slices this wide, so only nearby ones render. */
const CHUNK = 1280;
/** The dog picture is square; its feet sit about a quarter of the way up. */
const DOG_PICTURE_SIZE = 150;
/** How quickly the picture turns towards the slope angle, per second. */
const TILT_RATE = 12;
/** In the air the nose points up while rising and down while falling, this far at most. */
const MAX_AIR_TILT = 0.45;
/** The view rises to keep at least this much room above the dog's head. */
const HEADROOM = 90;
/** How quickly the view follows the dog up and back down, per second. */
const CAMERA_RATE = 6;
/** Distance the dog covers in one running step, for the bounce and snow puffs. */
const STRIDE = 75;
/** How high the dog bounces on each step. */
const STEP_BOUNCE = 6;
/** How long a puff of kicked-up snow lasts, in seconds. */
const PUFF_LIFE = 0.45;

interface Puff {
  image: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  age: number;
}

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
  private outfitGraphics!: Phaser.GameObjects.Graphics;
  private tilt = 0;
  private stride = 0;
  private lastDogX: number | null = null;
  private wasGrounded = true;
  private puffs: Puff[] = [];
  private cameraY: number | null = null;
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
    this.scale.on('resize', (size: Phaser.Structs.Size) => this.cameras.main.setSize(size.width, size.height));
    this.state = newGame(this.options.level.build(), this.options.level.speed);

    this.createBackdrop();
    this.createCourse();
    this.createDog();
    this.snow = new Snow(this);
    this.hud = new Hud(this, this.options.level.day, this.options.level.name, this.state.layout.checkpoints.length);

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

  /** Dress the dog in a new outfit, such as one with a just-won item. */
  setOutfit(outfit: Outfit): void {
    this.outfitGraphics.clear();
    drawOutfit(this.outfitGraphics, outfitShapes(outfit, this.options.dogId));
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
      if (this.state.events.includes('gameOver')) this.options.onGameOver();
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
        // Follows the camera up and down, so the hills stay on the ground when the view shows less sky.
        const container = this.add.container(0, 0, [g]).setScrollFactor(0, 1).setDepth(-100 + depth);
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
    const firstX = layout.ground[0]![0];
    const chunkAt = (x: number) => this.chunks[Math.min(this.chunks.length - 1, Math.max(0, Math.floor((x - firstX) / CHUNK)))]!;

    for (const [x0, x1] of layout.ground) {
      // Cut each run at the slice edges, so every slice holds only its own
      // stretch of ground and none goes missing when a slice is hidden.
      for (let x = x0; x < x1; ) {
        const sliceEnd = firstX + (Math.floor((x - firstX) / CHUNK) + 1) * CHUNK;
        const end = Math.min(sliceEnd, x1);
        art.drawGround(chunkAt(x), x, end);
        x = end;
      }
    }
    for (const [x0, x1] of gapsOf(layout)) art.drawPond(chunkAt(x0), x0, x1);
    for (const x of layout.hurdles) art.drawHurdle(chunkAt(x), hurdleBox(x));
    for (const x of layout.snowmen) art.drawSnowman(chunkAt(x), x, SNOWMAN_WIDTH, SNOWMAN_HEIGHT);
    for (const branch of layout.branches) art.drawBranch(chunkAt(branch.x0), branch);
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
    this.outfitGraphics = this.add.graphics();
    drawOutfit(this.outfitGraphics, outfitShapes(this.options.outfit, this.options.dogId));
    this.dogPicture = this.add.container(0, -2, [picture, this.outfitGraphics]);
    this.dog = this.add.container(0, 0, [this.dogPicture]).setDepth(10);
  }

  private render(dt: number): void {
    const { state } = this;
    const camera = this.cameras.main;
    camera.scrollX = leftEdge(state.scroll);
    // A short view shows the bottom of the world: the course, not the sky.
    // It rises when the dog climbs high enough to leave the top of the view.
    const bottomY = WORLD_HEIGHT - camera.height;
    const dogTop = art.sy(state.dog.body.center.y + state.dog.body.half.y);
    const targetY = Math.max(0, Math.min(bottomY, dogTop - HEADROOM));
    this.cameraY = this.cameraY === null ? targetY : this.cameraY + (targetY - this.cameraY) * Math.min(dt * CAMERA_RATE, 1);
    camera.scrollY = this.cameraY;

    for (const b of this.backdrops) {
      const x = (((b.baseX - state.scroll * b.depth) % b.span) + b.span) % b.span;
      b.container.x = x - b.span / 2 + WORLD_WIDTH / 2;
    }
    const firstX = state.layout.ground[0]![0];
    this.chunks.forEach((g, i) => {
      const x0 = firstX + i * CHUNK;
      // Obstacles are drawn in the slice where they start and may reach into
      // the next one, so a slice stays visible a whole slice beyond the view.
      g.setVisible(x0 < camera.scrollX + WORLD_WIDTH && x0 + 2 * CHUNK > camera.scrollX);
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
    const step = this.animateRun(dt);
    const { velocity } = state.dog.body;
    const airTilt = Math.max(-1, Math.min(1, velocity.y / JUMP_VELOCITY)) * MAX_AIR_TILT;
    const target = state.dog.groundAngle ?? airTilt;
    this.tilt += (target - this.tilt) * Math.min(dt * TILT_RATE, 1);
    this.dogPicture.setRotation(-this.tilt + step.wobble);
    this.dog.setAlpha(state.grace > 0 && Math.floor(this.elapsed * 8) % 2 === 0 ? 0.35 : 1);

    const flagsReached = state.checkpointsReached.filter(Boolean).length;
    this.hud.update(state.hearts, state.gingerbread, flagsReached, state.events.includes('heartLost'));
  }

  /**
   * A light running look without leg frames: the dog bounces and squashes a
   * little on every step and kicks up snow behind it, with a bigger puff on
   * landing. Returns the small rock of the body to add to its tilt.
   */
  private animateRun(dt: number): { wobble: number } {
    const body = this.state.dog.body;
    const grounded = body.grounded;
    const moved = this.lastDogX === null ? 0 : Math.max(body.center.x - this.lastDogX, 0);
    this.lastDogX = body.center.x;
    const feetY = art.sy(body.center.y - body.half.y);

    const before = Math.floor(this.stride);
    if (grounded) this.stride += moved / STRIDE;
    if (grounded && Math.floor(this.stride) !== before) {
      this.puff(body.center.x - 22, feetY, 3);
    }
    if (grounded && !this.wasGrounded) this.puff(body.center.x, feetY, 6);
    this.wasGrounded = grounded;

    const phase = this.stride * Math.PI;
    const lift = grounded ? Math.abs(Math.sin(phase)) : 0;
    const squash = grounded ? Math.cos(2 * phase) * 0.025 : 0;
    this.dogPicture.y = -2 - lift * STEP_BOUNCE;
    this.dogPicture.setScale(1 + squash, 1 - squash);

    for (const p of this.puffs) {
      if (!p.image.visible) continue;
      p.age += dt;
      const t = p.age / PUFF_LIFE;
      if (t >= 1) {
        p.image.setVisible(false);
        continue;
      }
      p.image.x += p.vx * dt;
      p.image.y += p.vy * dt;
      p.vy += 160 * dt;
      p.image.setAlpha(0.9 * (1 - t)).setScale(1.6 + t * 2.4);
    }
    return { wobble: grounded ? Math.sin(2 * phase) * 0.03 : 0 };
  }

  /** Kick up `count` little clouds of snow at a point on the ground. */
  private puff(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      let p = this.puffs.find((candidate) => !candidate.image.visible);
      if (!p) {
        // Tinted a little blue, so the puffs show against the white snow.
        p = { image: this.add.image(0, 0, 'flake').setDepth(9).setTint(0xb4cbe6), vx: 0, vy: 0, age: 0 };
        this.puffs.push(p);
      }
      p.image.setPosition(x + (Math.random() - 0.5) * 24, y - 2).setVisible(true).setAlpha(0.9).setScale(1.6);
      p.vx = -40 - Math.random() * 60;
      p.vy = -50 - Math.random() * 60;
      p.age = 0;
    }
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
