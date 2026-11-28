// Starts a level in a host element: the Phaser canvas plus the HTML parts
// around it (back button, rotate prompt and finish screen).

import Phaser from 'phaser';
import { WORLD_WIDTH } from '../../shared/constants.ts';
import type { Level } from '../../shared/levels/registry.ts';
import type { DogId } from '../../shared/profiles.ts';
import { score } from '../../shared/score.ts';
import type { Outfit } from '../../shared/wardrobe.ts';
import { dogPicture } from '../ui/dogPicture.ts';
import { el } from '../dom.ts';
import { dogLook } from './dogs.ts';
import { PlayScene } from './PlayScene.ts';
import { enterFullscreen, exitFullscreen, followVisibleViewport, viewHeight } from './viewport.ts';
import './game.css';

export interface RunResult {
  day: number;
  gingerbread: number;
  hearts: number;
  score: number;
}

/** What happened to a finished run's result. */
export interface SaveOutcome {
  status: 'saved' | 'saved-test' | 'practice' | 'failed';
  /** Name of the item this run won for the dog, the first time it finishes the door. */
  newItem?: string;
  /** The dog's outfit after the run, with a won item already on. */
  outfit?: Outfit;
}

export interface StartGameOptions {
  level: Level;
  dogId: DogId;
  outfit: Outfit;
  /** Called when the dog reaches the finish; resolves when saving is done. */
  saveResult: (result: RunResult) => Promise<SaveOutcome>;
  /** Called when the player leaves for the calendar. */
  onExit: () => void;
}

export interface GameHandle {
  destroy: () => void;
}

/** The finish screen accepts "play again" only after this long, so a tap at the line cannot skip it. */
const CELEBRATION_MIN_MS = 1000;
/** Seconds counted down before a paused run goes on. */
const RESUME_COUNTDOWN = 3;

const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

export function startGame(host: HTMLElement, options: StartGameOptions): GameHandle {
  const root = el('div', 'game-root');
  const canvasHost = el('div', 'game-canvas');
  const pauseButton = el('button', 'game-back', '❚❚');
  pauseButton.setAttribute('aria-label', 'Tauko');
  const rotate = el('div', 'game-rotate', 'Käännä puhelin vaakatasoon');
  const finish = el('div', 'game-finish');
  finish.hidden = true;
  const pauseScreen = el('div', 'game-finish game-pause');
  pauseScreen.hidden = true;
  const countdown = el('div', 'game-countdown');
  countdown.hidden = true;
  root.append(canvasHost, pauseButton, rotate, finish, pauseScreen, countdown);
  host.replaceChildren(root);

  let finishedAt = 0;
  let countdownTimer: ReturnType<typeof setTimeout> | null = null;
  const scene = new PlayScene({
    level: options.level,
    dogId: options.dogId,
    outfit: options.outfit,
    isPaused: () => portrait.matches || !finish.hidden || !pauseScreen.hidden || !countdown.hidden,
    onFinish: (gingerbread, hearts) => {
      finishedAt = performance.now();
      pauseButton.hidden = true;
      showFinish({ day: options.level.day, gingerbread, hearts, score: score(gingerbread, hearts) });
    },
    onGameOver: () => {
      finishedAt = performance.now();
      pauseButton.hidden = true;
      showGameOver();
    },
  });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: canvasHost,
    width: WORLD_WIDTH,
    height: viewHeight(window.innerWidth, window.innerHeight),
    backgroundColor: '#73adeb',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 1 },
    scene,
  });
  // The view is always the full course width; on wide screens it shows less
  // sky instead, so the course fills the screen and looks bigger on phones.
  const stopFollowing = followVisibleViewport(root, () => {
    const height = viewHeight(root.clientWidth, root.clientHeight);
    if (game.scale.height !== height) game.scale.setGameSize(WORLD_WIDTH, height);
    game.scale.refresh();
  });
  root.addEventListener('pointerdown', enterFullscreen, { once: true });

  const exit = () => {
    destroy();
    options.onExit();
  };

  /** Stop the run and ask whether to go on or stop. */
  function pause(): void {
    if (!finish.hidden || !pauseScreen.hidden) return;
    if (countdownTimer !== null) clearTimeout(countdownTimer);
    countdownTimer = null;
    countdown.hidden = true;
    pauseButton.hidden = true;
    pauseScreen.replaceChildren(
      el('h2', 'game-finish-title', 'Tauko'),
      el('p', 'game-finish-score', `Luukku ${options.level.day} · ${options.level.name}`),
    );
    const buttons = el('div', 'game-finish-buttons');
    const resume = el('button', 'game-button', 'Jatka');
    const stop = el('button', 'game-button game-button-secondary', 'Lopeta');
    buttons.append(resume, stop);
    pauseScreen.append(buttons);
    pauseScreen.hidden = false;
    resume.addEventListener('click', () => {
      pauseScreen.hidden = true;
      countDown(RESUME_COUNTDOWN);
    });
    stop.addEventListener('click', exit);
  }

  /** Show 3, 2, 1 over the paused course, then let the run go on. */
  function countDown(n: number): void {
    if (n === 0) {
      countdown.hidden = true;
      countdownTimer = null;
      pauseButton.hidden = false;
      return;
    }
    countdown.textContent = String(n);
    countdown.hidden = false;
    countdownTimer = setTimeout(() => countDown(n - 1), 700);
  }

  pauseButton.addEventListener('click', pause);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') pause();
  };
  // Leaving the game for another app or tab pauses it.
  const onHidden = () => {
    if (document.hidden) pause();
  };
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onHidden);

  /** Buttons appear after a moment, so a tap meant as a jump cannot press one. */
  function showButtonsSoon(buttons: HTMLElement): void {
    buttons.hidden = true;
    setTimeout(() => {
      buttons.hidden = false;
    }, Math.max(0, CELEBRATION_MIN_MS - (performance.now() - finishedAt)));
  }

  function showGameOver(): void {
    const again = el('button', 'game-button', 'Yritä uudelleen');
    const toCalendar = el('button', 'game-button game-button-secondary', 'Lopeta');
    const buttons = el('div', 'game-finish-buttons');
    buttons.append(again, toCalendar);
    finish.replaceChildren(
      el('h2', 'game-finish-title', 'Voi ei, sydämet loppuivat!'),
      el('p', 'game-finish-score', 'Haluatko yrittää rataa uudelleen alusta?'),
      buttons,
    );
    finish.hidden = false;
    showButtonsSoon(buttons);
    again.addEventListener('click', () => {
      finish.hidden = true;
      pauseButton.hidden = false;
      scene.restart();
    });
    toCalendar.addEventListener('click', exit);
  }

  function showFinish(result: RunResult): void {
    const dogName = dogLook(options.dogId).name;
    const status = el('p', 'game-finish-status', 'Tallennetaan tulosta…');
    const prize = el('div', 'game-finish-prize');
    prize.hidden = true;
    const again = el('button', 'game-button', 'Pelaa uudelleen');
    const toCalendar = el('button', 'game-button game-button-secondary', 'Takaisin kalenteriin');
    const buttons = el('div', 'game-finish-buttons');
    buttons.append(again, toCalendar);
    finish.replaceChildren(
      el('h2', 'game-finish-title', `Hienoa, ${dogName}!`),
      el('p', 'game-finish-score', `${result.gingerbread} piparia · ${result.hearts} ${result.hearts === 1 ? 'sydän' : 'sydäntä'}`),
      el('p', 'game-finish-points', `${result.score} pistettä`),
      prize,
      status,
      buttons,
    );
    finish.hidden = false;
    showButtonsSoon(buttons);

    const save = async () => {
      status.textContent = 'Tallennetaan tulosta…';
      const outcome = await options.saveResult(result).catch((): SaveOutcome => ({ status: 'failed' }));
      if (outcome.newItem && outcome.outfit) {
        prize.replaceChildren(
          dogPicture(options.dogId, outcome.outfit, 'game-prize-dog'),
          el('p', '', `🎁 Uusi varuste: ${outcome.newItem}!`),
        );
        prize.hidden = false;
        // The next try on this course already shows the new item.
        scene.setOutfit(outcome.outfit);
      }
      if (outcome.status === 'saved') {
        status.textContent = 'Tulos tallennettu!';
      } else if (outcome.status === 'practice') {
        status.textContent = 'Vapaa harjoittelu: tulosta ei tallenneta.';
      } else if (outcome.status === 'saved-test') {
        status.textContent = 'Testitulos tallennettu testilistalle.';
      } else {
        status.textContent = 'Tulosta ei saatu tallennettua. ';
        const retry = el('button', 'game-link', 'Yritä uudelleen');
        retry.addEventListener('click', () => void save());
        status.append(retry);
      }
    };
    void save();

    again.addEventListener('click', () => {
      finish.hidden = true;
      pauseButton.hidden = false;
      scene.restart();
    });
    toCalendar.addEventListener('click', exit);
  }

  let destroyed = false;
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (countdownTimer !== null) clearTimeout(countdownTimer);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onHidden);
    stopFollowing();
    exitFullscreen();
    game.destroy(true);
    root.remove();
  }

  return { destroy };
}
