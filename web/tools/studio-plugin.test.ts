import { describe, expect, it } from 'vitest';
import { placementSource } from './studio-plugin.ts';

describe('outfit studio save', () => {
  it('writes only placements that move an item, rounded, sorted by item and dog', () => {
    const source = placementSource({
      'santa-hat': {
        laku: { dx: 1.234, dy: -2, scale: 1.1, rotation: 5 },
        elmo: { dx: 0, dy: 0, scale: 1, rotation: 0 },
      },
      collar: { alma: { dx: 0, dy: 0, scale: 1, rotation: 0 } },
    });
    expect(source).toContain("  'santa-hat': {\n    laku: { dx: 1.23, dy: -2, scale: 1.1, rotation: 5 },\n  },");
    expect(source).not.toContain('elmo');
    expect(source).not.toContain('collar');
    expect(source).toContain('export const PLACEMENTS: Placements = {');
  });

  it('writes an empty table when nothing is moved', () => {
    expect(placementSource({})).toContain('export const PLACEMENTS: Placements = {};');
  });
});
