import './fonts.css';
import './ui/style.css';
import { api } from './api.ts';
import { App } from './ui/router.ts';

const root = document.querySelector<HTMLDivElement>('#app')!;

// The outfit studio exists only on the development server; the built game drops this branch.
if (import.meta.env.DEV && location.pathname === '/asustestudio') {
  void import('./studio/studio.ts').then(({ startStudio }) => startStudio(root));
} else {
  void new App(root, api).start();
}
