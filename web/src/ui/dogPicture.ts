// A dog in its outfit as an SVG picture, for the menus. The game draws the
// same shapes with Phaser, so the dog looks the same in both.

import type { DogId } from '../../shared/profiles.ts';
import { type Outfit, type Shape, outfitShapes } from '../../shared/wardrobe.ts';

const SVG = 'http://www.w3.org/2000/svg';
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function shapeElement(shape: Shape): SVGElement {
  const fill = (c: number, a = 1) => ({ fill: hex(c), 'fill-opacity': a });
  switch (shape.t) {
    case 'rect':
      return svg('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: shape.r ?? 0, ...fill(shape.c, shape.a) });
    case 'circle':
      return svg('circle', { cx: shape.x, cy: shape.y, r: shape.r, ...fill(shape.c, shape.a) });
    case 'ellipse':
      return svg('ellipse', { cx: shape.x, cy: shape.y, rx: shape.w / 2, ry: shape.h / 2, ...fill(shape.c, shape.a) });
    case 'poly':
      return svg('polygon', { points: shape.p.join(' '), ...fill(shape.c, shape.a) });
    case 'line':
      return svg('polyline', {
        points: shape.p.join(' '),
        fill: 'none',
        stroke: hex(shape.c),
        'stroke-width': shape.w,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
  }
}

/** The dog picture with its outfit drawn on top. */
export function dogPicture(dog: DogId, outfit: Outfit, className = 'dog-picture'): SVGSVGElement {
  const root = svg('svg', { viewBox: '-52 -62 104 104', class: className, 'aria-hidden': 'true' });
  const image = svg('image', { href: '/standing-right.png', x: -75, y: -75, width: 150, height: 150 });
  if (dog === 'alma') image.setAttribute('class', 'dog-alma');
  root.append(image, ...outfitShapes(outfit, dog).map(shapeElement));
  return root;
}
