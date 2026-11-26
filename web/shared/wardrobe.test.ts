import { describe, expect, it } from 'vitest';
import { DOG_IDS } from './profiles.ts';
import { DEFAULT_OUTFIT, ITEMS, NO_PLACEMENT, itemForDay, outfitParts, resolveOutfit, shapesCentre, unlockedItems } from './wardrobe.ts';

describe('wardrobe', () => {
  it('has one item for each of doors 1 to 9, with a look for every dog', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (let day = 1; day <= 9; day++) expect(itemForDay(day), `door ${day}`).toBeDefined();
    for (const item of ITEMS) {
      for (const dog of DOG_IDS) {
        const look = item.look(dog);
        expect(look.name.length, `${item.id} for ${dog}`).toBeGreaterThan(0);
        expect(look.shapes.length, `${item.id} for ${dog}`).toBeGreaterThan(0);
      }
    }
  });

  it('gives Alma her own items and Elmo and Laku the same ones in their own colours', () => {
    const antlers = itemForDay(3)!;
    expect(antlers.look('elmo').name).toBe(antlers.look('laku').name);
    expect(antlers.look('elmo').shapes).not.toEqual(antlers.look('laku').shapes);
    expect(antlers.look('alma').name).not.toBe(antlers.look('elmo').name);
  });

  it('dresses a dog in what it has won, the starting outfit where nothing was chosen', () => {
    const unlocked = unlockedItems([1, 2]);
    expect(resolveOutfit({}, unlocked)).toEqual(DEFAULT_OUTFIT);
    expect(resolveOutfit({ head: 'santa-hat', neck: 'scarf' }, unlocked)).toEqual({ head: 'santa-hat', neck: 'scarf' });
    // The neck is never bare: taking its item off brings the collar back.
    expect(resolveOutfit({ head: '', neck: '' }, unlocked)).toEqual({ neck: 'collar' });
    // An item not won, or in the wrong slot, gives way to the starting outfit.
    expect(resolveOutfit({ head: 'elf-hat', back: 'santa-hat' }, unlocked)).toEqual(DEFAULT_OUTFIT);
  });

  it('places each item by the studio settings for that dog, turning around its centre', () => {
    const placed = { dx: 2, dy: -3, scale: 1.2, rotation: 10 };
    const parts = outfitParts({ neck: 'collar', head: 'santa-hat' }, 'laku', { 'santa-hat': { laku: placed } });
    expect(parts.map((p) => p.itemId)).toEqual(['collar', 'santa-hat']);
    expect(parts[0]!.placement).toEqual(NO_PLACEMENT);
    expect(parts[1]!.placement).toEqual(placed);
    expect(shapesCentre([{ t: 'rect', x: 0, y: 0, w: 10, h: 4, c: 0 }])).toEqual({ x: 5, y: 2 });
  });
});
