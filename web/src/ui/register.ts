// The first screen: sign in with an existing player's code, or create a new
// player with a name and a dog.

import { DEFAULT_DOG, type DogId, MAX_NAME_LENGTH, PIN_LENGTH, cleanName, cleanPin } from '../../shared/profiles.ts';
import { dogCards } from './dogCards.ts';
import { el } from '../dom.ts';

export interface RegisterActions {
  /** Resolves false when no player has the code. */
  signIn: (pin: string) => Promise<boolean>;
  create: (name: string, dog: DogId) => Promise<void>;
}

const CONNECTION_ERROR = 'Yhteys palvelimeen ei onnistunut. Yritä uudelleen.';

export function registerScreen(actions: RegisterActions): HTMLElement {
  const screen = el('div', 'screen register');
  screen.append(el('h1', 'title', 'Agility Camp'), el('p', 'lead', 'Joulukalenteri, jossa uusi agilityrata avautuu joka päivä.'));

  // Returning players come first, so they do not create a second player by mistake.
  const signIn = el('form', 'panel');
  const pinLabel = el('label', 'field-label', 'Oletko jo pelannut? Kirjoita PIN-koodisi');
  const pin = pinInput();
  pinLabel.append(pin);
  const signInError = el('p', 'form-error');
  const signInButton = el('button', 'secondary', 'Jatka vanhana pelaajana');
  signInButton.type = 'submit';
  signIn.append(pinLabel, signInError, signInButton);
  signIn.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = cleanPin(pin.value);
    if (!code) {
      signInError.textContent = `PIN-koodissa on ${PIN_LENGTH} numeroa.`;
      return;
    }
    signInButton.disabled = true;
    signInError.textContent = '';
    try {
      if (!(await actions.signIn(code))) signInError.textContent = 'Tällä PIN-koodilla ei löytynyt pelaajaa.';
    } catch {
      signInError.textContent = CONNECTION_ERROR;
    }
    signInButton.disabled = false;
  });

  const create = el('form', 'panel');
  const nameLabel = el('label', 'field-label', 'Uusi pelaaja? Kirjoita oma nimesi');
  const name = el('input', 'name-input');
  name.maxLength = MAX_NAME_LENGTH;
  name.autocomplete = 'given-name';
  name.enterKeyHint = 'done';
  nameLabel.append(name);
  const cards = dogCards(DEFAULT_DOG);
  const createError = el('p', 'form-error');
  const createButton = el('button', 'primary', 'Luo uusi pelaaja');
  createButton.type = 'submit';
  create.append(nameLabel, el('p', 'field-label', 'Valitse koira'), cards.node, createError, createButton);
  create.addEventListener('submit', async (event) => {
    event.preventDefault();
    const clean = cleanName(name.value);
    if (!clean) {
      createError.textContent = `Kirjoita nimi (enintään ${MAX_NAME_LENGTH} merkkiä).`;
      return;
    }
    if (!window.confirm(`Luodaanko uusi pelaaja ${clean}?\n\nJos olet jo pelannut toisella laitteella, peruuta ja kirjoita PIN-koodisi, niin tuloksesi pysyvät tallessa.`)) {
      return;
    }
    createButton.disabled = true;
    createError.textContent = '';
    try {
      await actions.create(clean, cards.value());
    } catch {
      createError.textContent = CONNECTION_ERROR;
      createButton.disabled = false;
    }
  });

  screen.append(signIn, create);
  return screen;
}

function pinInput(): HTMLInputElement {
  const input = el('input', 'name-input pin-input');
  input.inputMode = 'numeric';
  input.autocomplete = 'one-time-code';
  input.maxLength = PIN_LENGTH + 2;
  input.placeholder = '123456';
  input.enterKeyHint = 'go';
  return input;
}

export function formatPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}
