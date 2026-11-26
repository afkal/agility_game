// The first screen: type your own name and pick a dog.

import { DEFAULT_DOG, type DogId, MAX_NAME_LENGTH, cleanName } from '../../shared/profiles.ts';
import { dogCards } from './dogCards.ts';
import { el } from '../dom.ts';

export function registerScreen(onSubmit: (name: string, dog: DogId) => Promise<void>): HTMLElement {
  const form = el('form', 'screen register');
  form.append(el('h1', 'title', 'Agility Camp'), el('p', 'lead', 'Joulukalenteri, jossa uusi agilityrata avautuu joka päivä.'));

  const nameLabel = el('label', 'field-label', 'Kirjoita oma nimesi');
  const name = el('input', 'name-input');
  name.maxLength = MAX_NAME_LENGTH;
  name.autocomplete = 'given-name';
  name.enterKeyHint = 'done';
  nameLabel.append(name);

  const cards = dogCards(DEFAULT_DOG);
  const error = el('p', 'form-error');
  const submit = el('button', 'primary', 'Aloita');
  submit.type = 'submit';
  form.append(nameLabel, el('p', 'field-label', 'Valitse koira'), cards.node, error, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const clean = cleanName(name.value);
    if (!clean) {
      error.textContent = `Kirjoita nimi (enintään ${MAX_NAME_LENGTH} merkkiä).`;
      return;
    }
    submit.disabled = true;
    error.textContent = '';
    try {
      await onSubmit(clean, cards.value());
    } catch {
      error.textContent = 'Yhteys palvelimeen ei onnistunut. Yritä uudelleen.';
      submit.disabled = false;
    }
  });
  return form;
}
