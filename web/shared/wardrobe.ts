// The dogs' wardrobe: what each dog can wear and when it is won.
//
// Every dog starts with a collar. Finishing a door's course with a dog wins
// that door's item for that dog, and the dog puts it on straight away, so
// running the same course again with another dog is worth it. Elmo and Laku
// get the same items in their own colours; Alma gets her own, girlier ones.
//
// Items are drawn from simple shapes in the dog picture's own coordinates: a
// 150 by 150 square centred on (0, 0), y growing down, the dog facing right.
// The game draws them with Phaser and the menus draw them as SVG, so a dog
// looks the same everywhere.

import type { DogId } from './profiles.ts';
import { PLACEMENTS } from './wardrobe-placement.ts';

export const SLOTS = ['back', 'neck', 'head'] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_NAMES: Record<Slot, string> = { head: 'Päähän', neck: 'Kaulaan', back: 'Selkään' };

export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; c: number; a?: number }
  | { t: 'circle'; x: number; y: number; r: number; c: number; a?: number }
  | { t: 'ellipse'; x: number; y: number; w: number; h: number; c: number; a?: number }
  | { t: 'poly'; p: number[]; c: number; a?: number }
  | { t: 'line'; p: number[]; w: number; c: number };

export interface ItemLook {
  name: string;
  shapes: Shape[];
}

export interface Item {
  id: string;
  slot: Slot;
  /** The door whose course wins it, or 0 for what every dog starts with. */
  day: number;
  look: (dog: DogId) => ItemLook;
}

const RED = 0xd91f29;
const GREEN = 0x1a9a50;
const BLUE = 0x3b6fd8;
const PINK = 0xf06aa8;
const LIGHT_PINK = 0xffb3d4;
const LILAC = 0xb48ce0;
const GOLD = 0xfacc38;
const SILVER = 0xc9d2de;
const WHITE = 0xf7faff;
/** Pink pearls, which show on Alma's white coat. */
const PEARL = 0xf49ac1;
const BROWN = 0x8a5a2b;
const BLACK = 0x22252c;

/** Elmo's and Laku's colour of a shared item. */
const boys = (dog: DogId, elmo: number, laku: number) => (dog === 'laku' ? laku : elmo);

const star = (x: number, y: number, r: number, c: number): Shape => ({
  t: 'poly',
  c,
  p: Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  }).flat(),
});

const scarf = (c: number): Shape[] => [
  { t: 'rect', x: 12, y: -22, w: 24, h: 9, r: 4, c },
  { t: 'poly', p: [14, -18, 4, -6, 10, -4], c },
];

export const ITEMS: readonly Item[] = [
  {
    id: 'collar',
    slot: 'neck',
    day: 0,
    look: (dog) => ({
      name: 'Kaulapanta',
      shapes: [
        { t: 'rect', x: 12, y: -20, w: 24, h: 5, r: 2.5, c: dog === 'alma' ? PINK : boys(dog, RED, GREEN) },
        { t: 'circle', x: 24, y: -13.5, r: 2.5, c: GOLD },
      ],
    }),
  },
  {
    id: 'scarf',
    slot: 'neck',
    day: 2,
    look: (dog) => ({ name: 'Kaulahuivi', shapes: scarf(dog === 'alma' ? PINK : boys(dog, RED, GREEN)) }),
  },
  {
    id: 'santa-hat',
    slot: 'head',
    day: 1,
    look: (dog) => ({
      name: 'Tonttulakki',
      shapes: [
        { t: 'poly', p: [21, -32, 41, -33, 16, -53], c: RED },
        { t: 'rect', x: 19.5, y: -35.5, w: 23, h: 7, r: 3.5, c: WHITE },
        { t: 'circle', x: 15, y: -53, r: 4.5, c: dog === 'alma' ? LIGHT_PINK : WHITE },
      ],
    }),
  },
  {
    id: 'antlers',
    slot: 'head',
    day: 3,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Rusetti',
            shapes: [
              { t: 'poly', p: [24, -36, 12, -44, 13, -30], c: PINK },
              { t: 'poly', p: [24, -36, 35, -46, 36, -31], c: PINK },
              { t: 'circle', x: 24, y: -36, r: 3.5, c: LIGHT_PINK },
            ],
          }
        : {
            name: 'Poronsarvet',
            shapes: [
              { t: 'line', p: [22, -33, 18, -46, 12, -54], w: 3.5, c: boys(dog, BROWN, GOLD) },
              { t: 'line', p: [18, -46, 24, -54], w: 3, c: boys(dog, BROWN, GOLD) },
              { t: 'line', p: [30, -34, 30, -48, 26, -57], w: 3.5, c: boys(dog, BROWN, GOLD) },
              { t: 'line', p: [30, -48, 36, -55], w: 3, c: boys(dog, BROWN, GOLD) },
            ],
          },
  },
  {
    id: 'bell-collar',
    slot: 'neck',
    day: 4,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Helmikaulakoru',
            shapes: [13, 18, 23, 28, 33].map((x, i) => ({ t: 'circle', x, y: -17 + (i % 2) * 1.5, r: 2.8, c: PEARL }) as Shape),
          }
        : {
            name: 'Kulkuspanta',
            shapes: [
              { t: 'rect', x: 12, y: -21, w: 24, h: 6, r: 3, c: boys(dog, RED, GREEN) },
              { t: 'circle', x: 24, y: -12, r: 4.5, c: boys(dog, GOLD, SILVER) },
              { t: 'rect', x: 22.5, y: -11, w: 3, h: 2, c: BLACK },
            ],
          },
  },
  {
    id: 'cape',
    slot: 'back',
    day: 5,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Keijunsiivet',
            shapes: [
              { t: 'ellipse', x: -2, y: -26, w: 18, h: 30, c: LIGHT_PINK, a: 0.75 },
              { t: 'ellipse', x: -12, y: -22, w: 16, h: 26, c: LILAC, a: 0.75 },
            ],
          }
        : {
            name: 'Viitta',
            shapes: [
              { t: 'poly', p: [14, -17, -20, -12, -27, 3, 8, -4], c: boys(dog, RED, BLUE) },
              { t: 'line', p: [-27, 3, 8, -4], w: 2.5, c: GOLD },
            ],
          },
  },
  {
    id: 'elf-hat',
    slot: 'head',
    day: 6,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Tiara',
            shapes: [
              { t: 'poly', p: [17, -33, 19, -42, 23, -36, 27, -45, 31, -36, 35, -42, 37, -33], c: GOLD },
              { t: 'circle', x: 27, y: -39, r: 2.5, c: PINK },
            ],
          }
        : {
            name: 'Tonttumyssy',
            shapes: [
              { t: 'poly', p: [20, -32, 40, -33, 4, -48], c: boys(dog, GREEN, BLUE) },
              { t: 'poly', p: [24, -36, 32, -36, 18, -41], c: boys(dog, RED, WHITE) },
              { t: 'rect', x: 19, y: -35.5, w: 23, h: 6, r: 3, c: boys(dog, RED, WHITE) },
              { t: 'circle', x: 3, y: -48, r: 4, c: GOLD },
            ],
          },
  },
  {
    id: 'bow-tie',
    slot: 'neck',
    day: 7,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Sydänriipus',
            shapes: [
              { t: 'line', p: [14, -20, 24, -14, 34, -20], w: 1.5, c: GOLD },
              { t: 'circle', x: 22.3, y: -12, r: 2.6, c: PINK },
              { t: 'circle', x: 25.7, y: -12, r: 2.6, c: PINK },
              { t: 'poly', p: [19.8, -11.2, 28.2, -11.2, 24, -6.5], c: PINK },
            ],
          }
        : {
            name: 'Rusetti',
            shapes: [
              { t: 'poly', p: [24, -16, 15, -21, 15, -11], c: boys(dog, RED, GREEN) },
              { t: 'poly', p: [24, -16, 33, -21, 33, -11], c: boys(dog, RED, GREEN) },
              { t: 'circle', x: 24, y: -16, r: 2.5, c: GOLD },
            ],
          },
  },
  {
    id: 'gift-bag',
    slot: 'back',
    day: 8,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Prinsessaviitta',
            shapes: [
              { t: 'poly', p: [14, -17, -20, -12, -28, 4, 8, -4], c: LILAC },
              star(-10, -6, 3.5, WHITE),
              star(2, -9, 3, WHITE),
            ],
          }
        : {
            name: 'Lahjareppu',
            shapes: [
              { t: 'rect', x: -14, y: -26, w: 20, h: 15, r: 2, c: boys(dog, RED, GREEN) },
              { t: 'rect', x: -6, y: -26, w: 4, h: 15, c: GOLD },
              { t: 'circle', x: -6, y: -28, r: 3, c: GOLD },
            ],
          },
  },
  {
    id: 'star-band',
    slot: 'head',
    day: 9,
    look: (dog) =>
      dog === 'alma'
        ? {
            name: 'Lumihiutalepanta',
            shapes: [
              { t: 'line', p: [17, -33, 27, -37, 37, -33], w: 2.5, c: PINK },
              { t: 'line', p: [27, -46, 27, -36], w: 2, c: 0x9edbf2 },
              { t: 'line', p: [22.5, -43.5, 31.5, -38.5], w: 2, c: 0x9edbf2 },
              { t: 'line', p: [22.5, -38.5, 31.5, -43.5], w: 2, c: 0x9edbf2 },
            ],
          }
        : {
            name: 'Tähtipanta',
            shapes: [{ t: 'line', p: [17, -33, 27, -37, 37, -33], w: 2.5, c: boys(dog, RED, BLUE) }, star(27, -43, 7, boys(dog, GOLD, SILVER))],
          },
  },
];

export type Outfit = Partial<Record<Slot, string>>;

export function itemById(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id);
}

/** The item a door's course wins, if it has one. */
export function itemForDay(day: number): Item | undefined {
  return ITEMS.find((item) => item.day === day);
}

/** What every dog wears until it is changed: its collar. */
export const DEFAULT_OUTFIT: Outfit = { neck: 'collar' };

/**
 * A dog always wears something on its neck: the colour there is what tells
 * black Elmo and Laku apart in the game.
 */
export const ALWAYS_WORN: Slot = 'neck';

/** Item ids a dog has, given the doors it has finished. */
export function unlockedItems(finishedDays: Iterable<number>): string[] {
  const days = new Set(finishedDays);
  return ITEMS.filter((item) => item.day === 0 || days.has(item.day)).map((item) => item.id);
}

/**
 * The outfit to show: the stored choices where the dog has those items, and
 * the starting outfit for any other slot. An empty string means "nothing".
 * A choice the dog does not have, such as an item won only in test mode, falls
 * back to the starting outfit.
 */
export function resolveOutfit(stored: Outfit, unlocked: readonly string[]): Outfit {
  const available = (id: string | undefined, slot: Slot) => Boolean(id && unlocked.includes(id) && itemById(id)?.slot === slot);
  const outfit: Outfit = {};
  for (const slot of SLOTS) {
    const choice = stored[slot];
    if (choice === '' && slot !== ALWAYS_WORN) continue;
    const item = available(choice, slot) ? choice : DEFAULT_OUTFIT[slot];
    if (available(item, slot)) outfit[slot] = item;
  }
  return outfit;
}

/**
 * How an item is moved, scaled and turned from where its shapes are drawn, to
 * sit right on one dog. Turning and scaling happen around the item's centre;
 * `rotation` is in degrees.
 */
export interface Placement {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

export type Placements = Record<string, Partial<Record<DogId, Placement>>>;

export const NO_PLACEMENT: Placement = { dx: 0, dy: 0, scale: 1, rotation: 0 };

export function placementOf(itemId: string, dog: DogId, placements: Placements = PLACEMENTS): Placement {
  return placements[itemId]?.[dog] ?? NO_PLACEMENT;
}

/** The middle of the box around some shapes: the point an item turns and scales around. */
export function shapesCentre(shapes: readonly Shape[]): { x: number; y: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const s of shapes) {
    if (s.t === 'rect') {
      add(s.x, s.y);
      add(s.x + s.w, s.y + s.h);
    } else if (s.t === 'circle') {
      add(s.x - s.r, s.y - s.r);
      add(s.x + s.r, s.y + s.r);
    } else if (s.t === 'ellipse') {
      add(s.x - s.w / 2, s.y - s.h / 2);
      add(s.x + s.w / 2, s.y + s.h / 2);
    } else {
      for (let i = 0; i < s.p.length; i += 2) add(s.p[i]!, s.p[i + 1]!);
    }
  }
  return shapes.length === 0 ? { x: 0, y: 0 } : { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** One worn item, ready to draw: its shapes, the point they turn around, and its placement. */
export interface OutfitPart {
  itemId: string;
  shapes: Shape[];
  centre: { x: number; y: number };
  placement: Placement;
}

/** The items of an outfit to draw, back first and head last. */
export function outfitParts(outfit: Outfit, dog: DogId, placements: Placements = PLACEMENTS): OutfitPart[] {
  return SLOTS.flatMap((slot) => {
    const id = outfit[slot];
    const item = id ? itemById(id) : undefined;
    if (!item) return [];
    const shapes = item.look(dog).shapes;
    return [{ itemId: item.id, shapes, centre: shapesCentre(shapes), placement: placementOf(item.id, dog, placements) }];
  });
}
