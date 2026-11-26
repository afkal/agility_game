import { LEVELS } from '../shared/levels/registry.ts';
import "./fonts.css";
import { startGame } from './game/startGame.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
startGame(app, {
  level: LEVELS[0]!,
  dogId: new URLSearchParams(location.search).get('dog') ?? 'elmo',
  saveResult: async () => 'not-saved',
  onExit: () => location.reload(),
});
