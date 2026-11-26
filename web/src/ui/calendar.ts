// The Advent calendar: the main view with 24 doors.

import type { Calendar, RosterEntry } from '../api.ts';
import { type DoorState, daysUntilFirstDoor } from '../../shared/calendar.ts';
import { WARMUP, levelForDay } from '../../shared/levels/registry.ts';
import type { DogId } from '../../shared/profiles.ts';
import { dogLook } from '../game/dogs.ts';
import { button, el } from '../dom.ts';
import { dogPicture } from './dogPicture.ts';
import { doorDisplay } from './flow.ts';

export interface CalendarActions {
  openDoor: (day: number, state: DoorState) => void;
  changeDog: () => void;
  showProfile: () => void;
  /** Start the warm-up course straight away; it has no leaderboard. */
  practise: () => void;
}

export function calendarScreen(
  playerName: string,
  dog: DogId,
  calendar: Calendar,
  roster: RosterEntry[] | null,
  actions: CalendarActions,
): HTMLElement {
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

  const countdown = daysUntilFirstDoor(calendar.today);
  const waiting = countdown !== null && !calendar.testMode;
  const intro = el('div', 'calendar-intro');
  if (waiting) {
    intro.append(
      el('p', 'countdown', countdown === 1 ? 'Ensimmäinen luukku aukeaa huomenna!' : `Ensimmäinen luukku aukeaa ${countdown} päivän päästä!`),
    );
  }
  // The warm-up course is open all the time, and is the thing to do while waiting.
  const warmup = el('button', 'warmup');
  warmup.type = 'button';
  warmup.append(el('span', 'warmup-name', `🏁 ${WARMUP.name}`), el('span', 'warmup-note', 'vapaa harjoittelu'));
  warmup.addEventListener('click', actions.practise);
  intro.append(warmup);

  const grid = el('div', 'doors');
  const { today } = calendar;
  const isToday = (day: number) => today.month === 12 && today.day === day;
  for (const door of calendar.doors) {
    const state = doorDisplay(door.state, Boolean(levelForDay(door.day)));
    const next = waiting && door.day === 1;
    const node = el('button', `door door-${state}${isToday(door.day) || next ? ' door-today' : ''}${next ? ' door-next' : ''}`);
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
  screen.append(header, intro, grid);
  if (roster && roster.length > 0) screen.append(startingLine(roster));
  return screen;
}

/** Everyone who has joined, each with their dog as it is dressed. */
function startingLine(roster: RosterEntry[]): HTMLElement {
  const section = el('section', 'starting-line');
  section.append(el('h2', 'starting-line-title', `Lähtöviivalla (${roster.length})`));
  const list = el('ul', 'starting-line-list');
  for (const entry of roster) {
    const item = el('li', 'starting-line-player');
    item.append(dogPicture(entry.dog, entry.outfit, 'starting-line-dog'), el('span', 'starting-line-name', entry.name), el('span', 'starting-line-dog-name', dogLook(entry.dog).name));
    list.append(item);
  }
  section.append(list);
  return section;
}
