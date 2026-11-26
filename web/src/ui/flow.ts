// The decisions behind the screens, kept free of the DOM so they can be tested.

import type { DoorState } from '../../shared/calendar.ts';
import type { Api } from '../api.ts';
import type { RunResult, SaveOutcome } from '../game/startGame.ts';

export type Screen = 'register' | 'calendar';

/** The first screen: registration without a remembered player, else the calendar. */
export function firstScreen(storedPlayerId: string | null): Screen {
  return storedPlayerId ? 'calendar' : 'register';
}

/**
 * How a door is shown. A door the server reports open but this page has no
 * level for (an old page after a new release) is shown as coming soon.
 */
export function doorDisplay(state: DoorState, hasLevel: boolean): DoorState {
  return state === 'open' && !hasLevel ? 'coming-soon' : state;
}

/** Saves a finished run for the player. In test mode the server keeps it on the test list. */
export function resultSaver(api: Pick<Api, 'postRun'>, playerId: string) {
  return async (result: RunResult): Promise<SaveOutcome> => {
    try {
      const res = await api.postRun({
        playerId,
        day: result.day,
        gingerbread: result.gingerbread,
        hearts: result.hearts,
      });
      if (!res.saved) return 'failed';
      return res.test ? 'saved-test' : 'saved';
    } catch {
      return 'failed';
    }
  };
}
