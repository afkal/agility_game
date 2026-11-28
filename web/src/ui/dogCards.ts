// The three dogs side by side in their outfits, for registration and for the
// dogs and wardrobe page.

import { DEFAULT_DOG, DOG_IDS, type DogId } from '../../shared/profiles.ts';
import { DEFAULT_OUTFIT, type Outfit } from '../../shared/wardrobe.ts';
import { dogLook } from '../game/dogs.ts';
import { el } from '../dom.ts';
import { dogPicture } from './dogPicture.ts';

export interface DogCards {
  node: HTMLElement;
  value: () => DogId;
  /** Draw a dog's card again in a new outfit. */
  redraw: (dog: DogId, outfit: Outfit) => void;
}

/** Radio cards for choosing a dog. */
export function dogCards(
  selected: DogId,
  outfits: Partial<Record<DogId, Outfit>> = {},
  onChange?: (dog: DogId) => void,
): DogCards {
  const node = el('div', 'dog-cards');
  node.setAttribute('role', 'radiogroup');
  const pictures = new Map<DogId, SVGSVGElement>();
  for (const id of DOG_IDS) {
    const label = el('label', 'dog-card');
    const input = el('input');
    input.type = 'radio';
    input.name = 'dog';
    input.value = id;
    input.checked = id === selected;
    input.addEventListener('change', () => onChange?.(id));
    const picture = dogPicture(id, outfits[id] ?? DEFAULT_OUTFIT);
    pictures.set(id, picture);
    label.append(input, picture, el('span', 'dog-name', dogLook(id).name));
    node.append(label);
  }
  return {
    node,
    value: () => (node.querySelector<HTMLInputElement>('input:checked')?.value ?? DEFAULT_DOG) as DogId,
    redraw(dog, outfit) {
      const old = pictures.get(dog);
      if (!old) return;
      const fresh = dogPicture(dog, outfit);
      old.replaceWith(fresh);
      pictures.set(dog, fresh);
    },
  };
}
