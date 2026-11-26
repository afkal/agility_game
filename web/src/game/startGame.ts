// Starts a level in a host element: the Phaser canvas plus the HTML parts
// around it (back button, rotate prompt and finish screen).

import Phaser from 'phaser';
import { WORLD_WIDTH } from '../../shared/constants.ts';
import type { Level } from '../../shared/levels/registry.ts';
import type { DogId } from '../../shared/profiles.ts';
import { score } from '../../shared/score.ts';
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
export type SaveOutcome = 'saved' | 'saved-test' | 'failed';

export interface StartGameOptions {
  level: Level;
  dogId: DogId;
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

const portrait = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

export function startGame(host: HTMLElement, options: StartGameOptions): GameHandle {
  const root = el('div', 'game-root');
  const canvasHost = el('div', 'game-canvas');
  const back = el('button', 'game-back', '✕');
  back.setAttribute('aria-label', 'Takaisin kalenteriin');
  const rotate = el('div', 'game-rotate', 'Käännä puhelin vaakatasoon');
  const finish = el('div', 'game-finish');
  finish.hidden = true;
  root.append(canvasHost, back, rotate, finish);
  host.replaceChildren(root);

  let finishedAt = 0;
  const scene = new PlayScene({
    level: options.level,
    dogId: options.dogId,
    isPaused: () => portrait.matches || !finish.hidden,
    onFinish: (gingerbread, hearts) => {
      finishedAt = performance.now();
      showFinish({ day: options.level.day, gingerbread, hearts, score: score(gingerbread, hearts) });
    },
    onGameOver: () => {
      finishedAt = performance.now();
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
  back.addEventListener('click', exit);

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
      scene.restart();
    });
    toCalendar.addEventListener('click', exit);
  }

  function showFinish(result: RunResult): void {
    const dogName = dogLook(options.dogId).name;
    const status = el('p', 'game-finish-status', 'Tallennetaan tulosta…');
    const again = el('button', 'game-button', 'Pelaa uudelleen');
    const toCalendar = el('button', 'game-button game-button-secondary', 'Takaisin kalenteriin');
    const buttons = el('div', 'game-finish-buttons');
    buttons.append(again, toCalendar);
    finish.replaceChildren(
      el('h2', 'game-finish-title', `Hienoa, ${dogName}!`),
      el('p', 'game-finish-score', `${result.gingerbread} piparia · ${result.hearts} ${result.hearts === 1 ? 'sydän' : 'sydäntä'}`),
      el('p', 'game-finish-points', `${result.score} pistettä`),
      status,
      buttons,
    );
    finish.hidden = false;
    showButtonsSoon(buttons);

    const save = async () => {
      status.textContent = 'Tallennetaan tulosta…';
      const outcome = await options.saveResult(result).catch((): SaveOutcome => 'failed');
      if (outcome === 'saved') {
        status.textContent = 'Tulos tallennettu!';
      } else if (outcome === 'saved-test') {
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
      scene.restart();
    });
    toCalendar.addEventListener('click', exit);
  }

  let destroyed = false;
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    stopFollowing();
    exitFullscreen();
    game.destroy(true);
    root.remove();
  }

  return { destroy };
}
