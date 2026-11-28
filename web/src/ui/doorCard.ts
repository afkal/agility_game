// An opened door: the level's name, its leaderboard and the play button.

import type { LeaderboardEntry } from '../api.ts';
import type { DoorState } from '../../shared/calendar.ts';
import type { Level } from '../../shared/levels/registry.ts';
import { dogLook } from '../game/dogs.ts';
import { button, el } from '../dom.ts';

export function doorCard(
  day: number,
  state: DoorState,
  level: Level | undefined,
  entries: LeaderboardEntry[] | null,
  actions: { play: () => void; close: () => void },
): HTMLElement {
  const backdrop = el('div', 'card-backdrop');
  const card = el('div', 'card');
  card.setAttribute('role', 'dialog');
  card.append(el('h2', 'card-title', level ? (day === 0 ? level.name : `Luukku ${day} · ${level.name}`) : `Luukku ${day}`));

  if (!level && state === 'open') {
    card.append(
      el('p', 'lead', 'Tämän luukun rata on jo valmis. Päivitä sivu, niin uusin versio latautuu.'),
      button('primary', 'Päivitä sivu', () => location.reload()),
    );
  } else if (!level) {
    card.append(el('p', 'lead', 'Tämän luukun rata on tulossa pian.'));
  } else {
    card.append(el('h3', 'card-subtitle', 'Parhaat tulokset'));
    if (entries === null) {
      card.append(el('p', 'lead', 'Tuloksia ei saatu ladattua.'));
    } else if (entries.length === 0) {
      card.append(el('p', 'lead', 'Kukaan ei ole vielä juossut tätä rataa. Ole ensimmäinen!'));
    } else {
      const list = el('ol', 'leaderboard');
      for (const entry of entries) {
        const row = el('li', 'leaderboard-row');
        row.append(
          el('span', 'leaderboard-name', `${entry.name} (${dogLook(entry.dog).name})`),
          el('span', 'leaderboard-score', String(entry.score)),
        );
        list.append(row);
      }
      card.append(list);
    }
    card.append(button('primary', 'Pelaa', actions.play));
  }
  card.append(button('secondary', 'Sulje', actions.close));
  backdrop.append(card);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) actions.close();
  });
  return backdrop;
}
