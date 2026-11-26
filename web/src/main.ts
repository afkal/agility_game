import './fonts.css';
import './ui/style.css';
import { api } from './api.ts';
import { App } from './ui/router.ts';

void new App(document.querySelector<HTMLDivElement>('#app')!, api).start();
