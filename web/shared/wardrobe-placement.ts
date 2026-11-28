// Where each item sits on each dog, as set in the outfit studio
// (/asustestudio on the development server). The studio rewrites this file;
// edit it there rather than by hand.

import type { Placements } from './wardrobe.ts';

export const PLACEMENTS: Placements = {
  'antlers': {
    alma: { dx: 1, dy: 5, scale: 0.96, rotation: -7 },
    elmo: { dx: -3.5, dy: 5, scale: 0.96, rotation: -7 },
    laku: { dx: -3.5, dy: 5, scale: 0.96, rotation: -7 },
  },
  'bell-collar': {
    alma: { dx: -3.5, dy: 3, scale: 0.83, rotation: 35 },
    elmo: { dx: -5.5, dy: 3, scale: 0.83, rotation: 35 },
    laku: { dx: -5.5, dy: 3, scale: 0.83, rotation: 35 },
  },
  'bow-tie': {
    alma: { dx: -9.5, dy: 8.5, scale: 1, rotation: 27 },
    elmo: { dx: -4.5, dy: 2.5, scale: 1, rotation: 27 },
    laku: { dx: -4.5, dy: 2.5, scale: 1, rotation: 27 },
  },
  'cape': {
    alma: { dx: 6, dy: 0.5, scale: 0.93, rotation: -30 },
    elmo: { dx: 0, dy: 1, scale: 1, rotation: -3 },
    laku: { dx: 0, dy: 1, scale: 1, rotation: -3 },
  },
  'collar': {
    alma: { dx: -5.5, dy: 3.5, scale: 0.84, rotation: 39 },
    elmo: { dx: -5.5, dy: 3.5, scale: 0.84, rotation: 39 },
    laku: { dx: -5.5, dy: 3.5, scale: 0.84, rotation: 39 },
  },
  'elf-hat': {
    alma: { dx: 0, dy: 6, scale: 1, rotation: -3 },
    elmo: { dx: -4, dy: 4, scale: 1, rotation: -3 },
    laku: { dx: -4, dy: 4, scale: 1, rotation: -3 },
  },
  'gift-bag': {
    alma: { dx: 1, dy: 1, scale: 1, rotation: -6 },
    elmo: { dx: 2.5, dy: 0, scale: 1, rotation: -10 },
    laku: { dx: 2.5, dy: 0, scale: 1, rotation: -10 },
  },
  'santa-hat': {
    alma: { dx: -3.5, dy: 2.5, scale: 1, rotation: 0 },
    elmo: { dx: -3.5, dy: 2.5, scale: 1, rotation: 0 },
    laku: { dx: -3.5, dy: 2.5, scale: 1, rotation: 0 },
  },
  'scarf': {
    alma: { dx: -6.5, dy: 2, scale: 0.97, rotation: 31 },
    elmo: { dx: -6.5, dy: 2, scale: 0.97, rotation: 31 },
    laku: { dx: -6.5, dy: 2, scale: 0.97, rotation: 31 },
  },
  'star-band': {
    alma: { dx: 0, dy: 7.5, scale: 1, rotation: -3 },
    elmo: { dx: 0, dy: 7.5, scale: 1, rotation: -3 },
    laku: { dx: 0, dy: 7.5, scale: 1, rotation: -3 },
  },
};
