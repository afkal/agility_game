// Moves between registration, the calendar, a door's card and play.

import type { Api, Calendar, Player, Wardrobe } from '../api.ts';
import { DOG_IDS, type DogId } from '../../shared/profiles.ts';
import { DEFAULT_OUTFIT, ITEMS, type Outfit, SLOTS, SLOT_NAMES } from '../../shared/wardrobe.ts';
import { dogLook } from '../game/dogs.ts';
import { dogPicture } from './dogPicture.ts';
import type { DoorState } from '../../shared/calendar.ts';
import { levelForDay } from '../../shared/levels/registry.ts';
import { calendarScreen } from './calendar.ts';
import { dogCards } from './dogCards.ts';
import { doorCard } from './doorCard.ts';
import { button, el } from '../dom.ts';
import { firstScreen, resultSaver } from './flow.ts';
import { formatPin, registerScreen, welcomeScreen } from './register.ts';
import { MAX_NAME_LENGTH, cleanName } from '../../shared/profiles.ts';

const PLAYER_STORAGE = 'agility-camp.player';

function storedPlayerId(): string | null {
  try {
    return localStorage.getItem(PLAYER_STORAGE);
  } catch {
    return null;
  }
}

function storePlayerId(id: string | null): void {
  try {
    if (id) localStorage.setItem(PLAYER_STORAGE, id);
    else localStorage.removeItem(PLAYER_STORAGE);
  } catch {
    // Private browsing: the player is asked again next time.
  }
}

export class App {
  private readonly root: HTMLElement;
  private readonly api: Api;
  private player: Player | null = null;
  private calendar: Calendar | null = null;
  private wardrobe: Wardrobe | null = null;
  /** Changes whenever the screen changes, so late async results can tell they are stale. */
  private screen = 0;
  private doorLoading = false;

  constructor(root: HTMLElement, api: Api) {
    this.root = root;
    this.api = api;
  }

  async start(): Promise<void> {
    const id = storedPlayerId();
    if (id !== null && firstScreen(id) === 'calendar') {
      try {
        this.player = await this.api.getPlayer(id);
      } catch {
        this.showError(() => void this.start());
        return;
      }
    }
    if (this.player) await this.showCalendar();
    else this.showRegister();
  }

  private show(node: HTMLElement): void {
    this.screen += 1;
    this.root.replaceChildren(node);
    window.scrollTo(0, 0);
  }

  private showError(retry: () => void, message = 'Yhteys palvelimeen ei onnistunut.', action = 'Yritä uudelleen'): void {
    const screen = el('div', 'screen');
    screen.append(el('h1', 'title', 'Agility Camp'), el('p', 'lead', message), button('primary', action, retry));
    this.show(screen);
  }

  private showRegister(): void {
    this.show(
      registerScreen({
        signIn: async (pin) => {
          const player = await this.api.signIn(pin);
          if (!player) return false;
          this.player = player;
          storePlayerId(player.id);
          await this.showCalendar();
          return true;
        },
        create: async (name, dog) => {
          const player = await this.api.register(name, dog);
          this.player = player;
          storePlayerId(player.id);
          this.show(welcomeScreen(player.name, player.pin, () => void this.showCalendar()));
        },
      }),
    );
  }

  /** The player's own page: their sign-in code, a new name, or leaving this device. */
  private showProfile(): void {
    const player = this.player!;
    const screen = el('div', 'screen');
    const nameLabel = el('label', 'field-label', 'Nimi tuloslistoilla');
    const name = el('input', 'name-input');
    name.maxLength = MAX_NAME_LENGTH;
    name.value = player.name;
    nameLabel.append(name);
    const message = el('p', 'form-error');
    screen.append(
      el('h1', 'title', 'Oma pelaaja'),
      el('p', 'lead', 'PIN-koodisi. Sillä pääset jatkamaan omilla tuloksillasi toisella laitteella.'),
      el('p', 'pin-code', formatPin(player.pin)),
      nameLabel,
      message,
      button('primary', 'Tallenna nimi', async () => {
        const clean = cleanName(name.value);
        if (!clean) {
          message.textContent = `Kirjoita nimi (enintään ${MAX_NAME_LENGTH} merkkiä).`;
          return;
        }
        try {
          this.player = await this.api.updatePlayer(player.id, { name: clean });
          await this.showCalendar();
        } catch {
          message.textContent = 'Yhteys palvelimeen ei onnistunut. Yritä uudelleen.';
        }
      }),
      button('secondary', 'Takaisin kalenteriin', () => void this.showCalendar()),
      button('link-button', 'Kirjaudu ulos tältä laitteelta', () => {
        const ok = window.confirm(
          `Kirjaudutaanko ulos? Pääset takaisin pelaajaksi ${player.name} vain PIN-koodilla ${formatPin(player.pin)}. Kirjoita se muistiin ennen kuin jatkat.`,
        );
        if (!ok) return;
        storePlayerId(null);
        this.player = null;
        this.showRegister();
      }),
    );
    this.show(screen);
  }

  /** Choose the dog to play with, and dress each dog in the items it has won. */
  private async showDogs(): Promise<void> {
    const player = this.player!;
    const screenToken = this.screen;
    let wardrobe: Wardrobe;
    try {
      wardrobe = await this.api.wardrobe(player.id);
    } catch {
      this.showError(() => void this.showDogs());
      return;
    }
    if (screenToken !== this.screen) return;
    this.wardrobe = wardrobe;

    const screen = el('div', 'screen');
    const error = el('p', 'form-error');
    const closet = el('div', 'wardrobe');
    const outfits = Object.fromEntries(DOG_IDS.map((dog) => [dog, wardrobe.dogs[dog].outfit])) as Record<DogId, Outfit>;
    const cards = dogCards(player.dog, outfits, (dog) => drawCloset(dog));

    const drawCloset = (dog: DogId) => {
      const { unlocked, outfit } = wardrobe.dogs[dog];
      closet.replaceChildren(el('h2', 'field-label', `${dogLook(dog).name}n vaatekaappi`), dogPicture(dog, outfit, 'dog-preview'));
      // Listed from the head down; drawn from the back up, so the head goes on top.
      for (const slot of [...SLOTS].reverse()) {
        const row = el('div', 'wardrobe-slot');
        const items = el('div', 'wardrobe-items');
        const choose = async (item: string | null) => {
          try {
            wardrobe = await this.api.setOutfitItem(player.id, dog, slot, item);
            this.wardrobe = wardrobe;
            error.textContent = '';
            cards.redraw(dog, wardrobe.dogs[dog].outfit);
            drawCloset(dog);
          } catch {
            error.textContent = 'Yhteys palvelimeen ei onnistunut. Yritä uudelleen.';
          }
        };
        const none = button(`item-chip${outfit[slot] ? '' : ' chosen'}`, 'Ei mitään', () => void choose(null));
        items.append(none);
        for (const item of ITEMS.filter((i) => i.slot === slot)) {
          const owned = unlocked.includes(item.id);
          const label = owned ? item.look(dog).name : `🔒 Luukku ${item.day}`;
          const chip = button(`item-chip${outfit[slot] === item.id ? ' chosen' : ''}`, label, () => void choose(item.id));
          chip.disabled = !owned;
          items.append(chip);
        }
        row.append(el('h2', '', SLOT_NAMES[slot]), items);
        closet.append(row);
      }
    };
    drawCloset(player.dog);

    screen.append(
      el('h1', 'title', 'Koirat ja varusteet'),
      el('p', 'lead', 'Valitse koira, jolla pelaat. Jokainen koira voittaa luukun varusteen, kun se juoksee radan maaliin.'),
      cards.node,
      closet,
      error,
      button('primary', 'Valmis', async () => {
        try {
          if (cards.value() !== player.dog) this.player = await this.api.updatePlayer(player.id, { dog: cards.value() });
          await this.showCalendar();
        } catch {
          error.textContent = 'Yhteys palvelimeen ei onnistunut. Yritä uudelleen.';
        }
      }),
    );
    this.show(screen);
  }

  private async showCalendar(): Promise<void> {
    const player = this.player!;
    try {
      // The outfit is only decoration: without it the dog plays in its starting outfit.
      const [calendar, wardrobe] = await Promise.all([
        this.api.calendar(player.id),
        this.api.wardrobe(player.id).catch(() => null),
      ]);
      this.calendar = calendar;
      this.wardrobe = wardrobe;
    } catch {
      this.showError(() => void this.showCalendar());
      return;
    }
    this.show(
      calendarScreen(player.name, player.dog, this.calendar, {
        openDoor: (day, state) => void this.openDoor(day, state),
        changeDog: () => void this.showDogs(),
        showProfile: () => this.showProfile(),
      }),
    );
  }

  private async openDoor(day: number, state: DoorState): Promise<void> {
    if (this.doorLoading) return;
    const level = levelForDay(day);
    const screen = this.screen;
    this.doorLoading = true;
    const entries = level ? await this.api.leaderboard(day).catch(() => null) : [];
    this.doorLoading = false;
    if (screen !== this.screen) return;
    const card = doorCard(day, state, level, entries, {
      play: () => {
        card.remove();
        void this.play(day);
      },
      close: () => card.remove(),
    });
    this.root.append(card);
  }

  private async play(day: number): Promise<void> {
    const level = levelForDay(day);
    const player = this.player;
    if (!level || !player) return;
    const host = el('div', 'lead', 'Ladataan…');
    this.show(host);
    try {
      const { startGame } = await import('../game/startGame.ts');
      startGame(host, {
        level,
        dogId: player.dog,
        outfit: this.wardrobe?.dogs[player.dog].outfit ?? DEFAULT_OUTFIT,
        saveResult: resultSaver(this.api, player.id),
        onExit: () => void this.showCalendar(),
      });
    } catch {
      // After a release the old game files are gone; a reload fetches the new ones.
      this.showError(() => location.reload(), 'Peli ei latautunut. Päivitä sivu, niin uusin versio latautuu.', 'Päivitä sivu');
    }
  }
}
