// The three dogs share one schnauzer silhouette. Elmo and Laku are black and
// told apart by their scarves; Alma is white.

import type Phaser from 'phaser';
import { type DogId, isDogId } from '../../shared/players.ts';

export interface DogLook {
  name: string;
  texture: 'dog-black' | 'dog-white';
  /** Base colour of the silhouette, for menu cards. */
  color: string;
  scarf: number;
}

const LOOKS: Record<DogId, DogLook> = {
  elmo: { name: 'Elmo', texture: 'dog-black', color: '#000000', scarf: 0xd91f29 },
  laku: { name: 'Laku', texture: 'dog-black', color: '#000000', scarf: 0x1a9a50 },
  alma: { name: 'Alma', texture: 'dog-white', color: '#ffffff', scarf: 0x3b6fd8 },
};

/** How a dog looks; an unknown id falls back to Elmo. */
export function dogLook(id: unknown): DogLook {
  return LOOKS[isDogId(id) ? id : 'elmo'];
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
  // A grey outline under a snow-white silhouette, so the white dog still reads
  // against the snow.
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
