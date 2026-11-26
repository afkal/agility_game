// The three dogs side by side, for registration and for changing dog.

import { DOG_IDS, type DogId } from '../../shared/players.ts';
import { dogLook } from '../game/dogs.ts';
import { el } from './dom.ts';

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Radio cards for choosing a dog; returns the container and a getter. */
export function dogCards(selected: string): { node: HTMLElement; value: () => DogId } {
  const node = el('div', 'dog-cards');
  node.setAttribute('role', 'radiogroup');
  for (const id of DOG_IDS) {
    const look = dogLook(id);
    const label = el('label', 'dog-card');
    const input = el('input');
    input.type = 'radio';
    input.name = 'dog';
    input.value = id;
    input.checked = id === selected;
    const picture = el('img', `dog-picture dog-${id}`);
    picture.src = '/standing-right.png';
    picture.alt = '';
    const scarf = el('span', 'dog-scarf');
    scarf.style.background = hex(look.scarf);
    label.append(input, picture, scarf, el('span', 'dog-name', look.name));
    node.append(label);
  }
  return {
    node,
    value: () => (node.querySelector<HTMLInputElement>('input:checked')?.value ?? 'elmo') as DogId,
  };
}
