import { describe, expect, it } from 'vitest';
import { dogLook } from './dogs.ts';

describe('dog looks', () => {
  it('draws Elmo and Laku black with different scarves and Alma white', () => {
    expect(dogLook('elmo').texture).toBe('dog-black');
    expect(dogLook('laku').texture).toBe('dog-black');
    expect(dogLook('alma').texture).toBe('dog-white');
    expect(dogLook('elmo').scarf).not.toBe(dogLook('laku').scarf);
  });

  it('falls back to Elmo for an unknown dog', () => {
    expect(dogLook('rex')).toEqual(dogLook('elmo'));
    expect(dogLook(undefined).name).toBe('Elmo');
  });
});
