import { describe, expect, it } from 'vitest';
import { DOG_IDS } from './profiles.ts';
import { DEFAULT_OUTFIT, ITEMS, itemForDay, outfitShapes, resolveOutfit, unlockedItems } from './wardrobe.ts';

describe('wardrobe', () => {
  it('has one item for each of doors 1 to 7, with a look for every dog', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (let day = 1; day <= 7; day++) expect(itemForDay(day), `door ${day}`).toBeDefined();
    for (const item of ITEMS) {
      for (const dog of DOG_IDS) {
        const look = item.look(dog);
        expect(look.name.length, `${item.id} for ${dog}`).toBeGreaterThan(0);
        expect(look.shapes.length, `${item.id} for ${dog}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives Alma her own items and Elmo and Laku the same ones in their own colours', () => {
    const antlers = itemForDay(1)!;
    expect(antlers.look('elmo').name).toBe(antlers.look('laku').name);
    expect(antlers.look('elmo').shapes).not.toEqual(antlers.look('laku').shapes);
    expect(antlers.look('alma').name).not.toBe(antlers.look('elmo').name);
  });

  it('dresses a dog in what it has won, the starting outfit where nothing was chosen', () => {
    const unlocked = unlockedItems([1]);
    expect(resolveOutfit({}, unlocked)).toEqual(DEFAULT_OUTFIT);
    expect(resolveOutfit({ head: 'antlers', neck: '' }, unlocked)).toEqual({ head: 'antlers' });
    // An item not won, or in the wrong slot, gives way to the starting outfit.
    expect(resolveOutfit({ head: 'elf-hat', back: 'antlers' }, unlocked)).toEqual(DEFAULT_OUTFIT);
    expect(outfitShapes(DEFAULT_OUTFIT, 'elmo').length).toBeGreaterThan(0);
  });
});
