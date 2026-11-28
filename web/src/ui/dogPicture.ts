// A dog in its outfit as an SVG picture, for the menus. The game draws the
// same shapes with Phaser, so the dog looks the same in both.

import type { DogId } from '../../shared/profiles.ts';
import { type Outfit, type OutfitPart, type Placements, type Shape, outfitParts } from '../../shared/wardrobe.ts';

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

const WHITE_DOG_FILTER = 'white-dog';

/** Alma's look: the black silhouette turned white with a thin grey outline, as in the game. */
function ensureWhiteDogFilter(): void {
  if (document.getElementById(WHITE_DOG_FILTER)) return;
  const holder = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute' });
  const filter = svg('filter', { id: WHITE_DOG_FILTER, x: '-5%', y: '-5%', width: '110%', height: '110%' });
  filter.append(
    svg('feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: 1, result: 'grown' }),
    svg('feFlood', { 'flood-color': '#4a5a72', result: 'edgeColour' }),
    svg('feComposite', { in: 'edgeColour', in2: 'grown', operator: 'in', result: 'outline' }),
    svg('feFlood', { 'flood-color': '#f4f6fa', result: 'bodyColour' }),
    svg('feComposite', { in: 'bodyColour', in2: 'SourceAlpha', operator: 'in', result: 'body' }),
  );
  const merge = svg('feMerge', {});
  merge.append(svg('feMergeNode', { in: 'outline' }), svg('feMergeNode', { in: 'body' }));
  filter.append(merge);
  const defs = svg('defs', {});
  defs.append(filter);
  holder.append(defs);
  document.body.append(holder);
}

/** One item as an SVG group, moved, turned and scaled into its place on the dog. */
export function partElement(part: OutfitPart): SVGGElement {
  const { centre, placement: p } = part;
  const group = svg('g', {
    transform: `translate(${centre.x + p.dx} ${centre.y + p.dy}) rotate(${p.rotation}) scale(${p.scale}) translate(${-centre.x} ${-centre.y})`,
    'data-item': part.itemId,
  });
  group.append(...part.shapes.map(shapeElement));
  return group;
}

/** The dog picture with its outfit drawn on top. The studio passes its unsaved placements. */
export function dogPicture(
  dog: DogId,
  outfit: Outfit,
  className = 'dog-picture',
  placements?: Placements,
  viewBox = '-52 -62 104 104',
): SVGSVGElement {
  const root = svg('svg', { viewBox, class: className, 'aria-hidden': 'true' });
  const image = svg('image', { href: '/standing-right.png', x: -75, y: -75, width: 150, height: 150 });
  if (dog === 'alma') {
    // An SVG filter, not a CSS one: mobile Chrome ignores CSS filters inside SVG.
    ensureWhiteDogFilter();
    image.setAttribute('filter', `url(#${WHITE_DOG_FILTER})`);
  }
  root.append(image, ...outfitParts(outfit, dog, placements).map(partElement));
  return root;
}
