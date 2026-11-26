// The Advent calendar: the main view with 24 doors.

import type { Calendar } from '../api.ts';
import type { DoorState } from '../../shared/calendar.ts';
import { levelForDay } from '../../shared/levels/registry.ts';
import type { DogId } from '../../shared/profiles.ts';
import { dogLook } from '../game/dogs.ts';
import { button, el } from '../dom.ts';
import { doorDisplay } from './flow.ts';

export interface CalendarActions {
  openDoor: (day: number, state: DoorState) => void;
  changeDog: () => void;
  showProfile: () => void;
}

export function calendarScreen(playerName: string, dog: DogId, calendar: Calendar, actions: CalendarActions): HTMLElement {
  const screen = el('div', 'screen calendar');
  const header = el('header', 'calendar-header');
  header.append(
    el('h1', 'title', 'Agility Camp'),
    el('p', 'who', `${playerName} ja ${dogLook(dog).name}`),
  );
  const tools = el('div', 'calendar-tools');
  tools.append(button('small', 'Koirat ja varusteet', actions.changeDog), button('small', 'Oma pelaaja', actions.showProfile));
  header.append(tools);
  if (calendar.testMode) header.append(el('p', 'test-badge', 'testitila'));

  const grid = el('div', 'doors');
  const { today } = calendar;
  const isToday = (day: number) => today.month === 12 && today.day === day;
  for (const door of calendar.doors) {
    const state = doorDisplay(door.state, Boolean(levelForDay(door.day)));
    const node = el('button', `door door-${state}${isToday(door.day) ? ' door-today' : ''}`);
    node.type = 'button';
    node.append(el('span', 'door-number', String(door.day)));
    if (state === 'open') {
      node.append(el('span', 'door-note', door.best === null ? 'Avaa!' : `★ ${door.best}`));
    } else if (state === 'coming-soon') {
      node.append(el('span', 'door-note', 'Tulossa'));
    }
    node.disabled = state === 'closed';
    node.addEventListener('click', () => actions.openDoor(door.day, door.state));
    grid.append(node);
  }
  screen.append(header, grid);
  if (calendar.season === null && !calendar.testMode) {
    screen.append(el('p', 'lead', 'Ensimmäinen luukku aukeaa 1. joulukuuta.'));
  }
  return screen;
}
