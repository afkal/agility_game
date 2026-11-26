// Moves between registration, the calendar, a door's card and play.

import type { Api, Calendar, Player } from '../api.ts';
import { levelForDay } from '../../shared/levels/registry.ts';
import { calendarScreen } from './calendar.ts';
import { dogCards } from './dogCards.ts';
import { doorCard } from './doorCard.ts';
import { button, el } from '../dom.ts';
import { firstScreen, resultSaver } from './flow.ts';
import { registerScreen } from './register.ts';

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
    this.root.replaceChildren(node);
    window.scrollTo(0, 0);
  }

  private showError(retry: () => void): void {
    const screen = el('div', 'screen');
    screen.append(
      el('h1', 'title', 'Agility Camp'),
      el('p', 'lead', 'Yhteys palvelimeen ei onnistunut.'),
      button('primary', 'Yritä uudelleen', retry),
    );
    this.show(screen);
  }

  private showRegister(): void {
    this.show(
      registerScreen(async (name, dog) => {
        this.player = await this.api.register(name, dog);
        storePlayerId(this.player.id);
        await this.showCalendar();
      }),
    );
  }

  private showDogChoice(): void {
    const player = this.player!;
    const screen = el('div', 'screen');
    const cards = dogCards(player.dog);
    const error = el('p', 'form-error');
    screen.append(
      el('h1', 'title', 'Valitse koira'),
      cards.node,
      error,
      button('primary', 'Valmis', async () => {
        try {
          this.player = await this.api.setDog(player.id, cards.value());
          await this.showCalendar();
        } catch {
          error.textContent = 'Yhteys palvelimeen ei onnistunut. Yritä uudelleen.';
        }
      }),
      button('secondary', 'Peruuta', () => void this.showCalendar()),
    );
    this.show(screen);
  }

  private async showCalendar(): Promise<void> {
    const player = this.player!;
    try {
      this.calendar = await this.api.calendar(player.id);
    } catch {
      this.showError(() => void this.showCalendar());
      return;
    }
    this.show(
      calendarScreen(player.name, player.dog, this.calendar, {
        openDoor: (day) => void this.openDoor(day),
        changeDog: () => this.showDogChoice(),
        switchPlayer: () => {
          storePlayerId(null);
          this.player = null;
          this.showRegister();
        },
      }),
    );
  }

  private async openDoor(day: number): Promise<void> {
    const level = levelForDay(day);
    const entries = level ? await this.api.leaderboard(day).catch(() => null) : [];
    const card = doorCard(day, level, entries, {
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
    const { startGame } = await import('../game/startGame.ts');
    startGame(host, {
      level,
      dogId: player.dog,
      saveResult: resultSaver(this.api, player.id, Boolean(this.calendar?.testMode)),
      onExit: () => void this.showCalendar(),
    });
  }
}
