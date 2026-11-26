// The three dogs share one schnauzer silhouette. Elmo and Laku are black and
// told apart by their outfits' colours; Alma is white.

import type Phaser from 'phaser';
import { DEFAULT_DOG, type DogId, isDogId } from '../../shared/profiles.ts';
import type { Shape } from '../../shared/wardrobe.ts';

export interface DogLook {
  name: string;
  texture: 'dog-black' | 'dog-white';
}

const LOOKS: Record<DogId, DogLook> = {
  elmo: { name: 'Elmo', texture: 'dog-black' },
  laku: { name: 'Laku', texture: 'dog-black' },
  alma: { name: 'Alma', texture: 'dog-white' },
};

/** Draw outfit shapes, given in the dog picture's own coordinates. */
export function drawOutfit(g: Phaser.GameObjects.Graphics, shapes: readonly Shape[]): void {
  for (const s of shapes) {
    if (s.t === 'line') {
      g.lineStyle(s.w, s.c, 1);
      g.beginPath();
      g.moveTo(s.p[0]!, s.p[1]!);
      for (let i = 2; i < s.p.length; i += 2) g.lineTo(s.p[i]!, s.p[i + 1]!);
      g.strokePath();
      continue;
    }
    g.fillStyle(s.c, s.a ?? 1);
    if (s.t === 'rect') {
      if (s.r) g.fillRoundedRect(s.x, s.y, s.w, s.h, s.r);
      else g.fillRect(s.x, s.y, s.w, s.h);
    } else if (s.t === 'circle') {
      g.fillCircle(s.x, s.y, s.r);
    } else if (s.t === 'ellipse') {
      g.fillEllipse(s.x, s.y, s.w, s.h);
    } else {
      const points = [];
      for (let i = 0; i < s.p.length; i += 2) points.push({ x: s.p[i]!, y: s.p[i + 1]! });
      g.fillPoints(points as Phaser.Math.Vector2[], true);
    }
  }
}

/** How a dog looks; an unknown id falls back to Elmo. */
export function dogLook(id: unknown): DogLook {
  return LOOKS[isDogId(id) ? id : DEFAULT_DOG];
}

/** Add a white copy of the loaded black silhouette as the 'dog-white' texture. */
export function addWhiteDogTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists('dog-white')) return;
  const source = scene.textures.get('dog-black').getSourceImage() as HTMLImageElement;
  const tinted = (color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  };
  const outline = tinted('#4a5a72');
  const white = tinted('#f4f6fa');
  const result = document.createElement('canvas');
  result.width = source.width;
  result.height = source.height;
  const ctx = result.getContext('2d')!;
  const width = Math.max(2, Math.round(source.width / 120));
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    ctx.drawImage(outline, Math.cos(angle) * width, Math.sin(angle) * width);
  }
  ctx.drawImage(white, 0, 0);
  scene.textures.addCanvas('dog-white', result);
}
