// Which Advent calendar doors are open on a given day.

export const DOOR_COUNT = 24;
/** The first December the calendar runs. Before it every door is closed. */
export const FIRST_SEASON = 2026;

export interface CalendarDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

export type DoorState = 'closed' | 'open' | 'coming-soon';

/** The calendar date in Finland at `now`. */
export function helsinkiDate(now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/**
 * The season a date belongs to: the year of the most recent 1 December on or
 * before it, or null before the first season. January to November still belong
 * to the previous December, so its doors stay open until the next one starts.
 */
export function seasonOf(date: CalendarDate): number | null {
  const season = date.month === 12 ? date.year : date.year - 1;
  return season >= FIRST_SEASON ? season : null;
}

/**
 * Days from `date` to the first December the calendar opens, or null once it
 * has started.
 */
export function daysUntilFirstDoor(date: CalendarDate): number | null {
  if (seasonOf(date) !== null) return null;
  const opening = Date.UTC(Math.max(date.year, FIRST_SEASON), 11, 1);
  const today = Date.UTC(date.year, date.month - 1, date.day);
  return Math.round((opening - today) / 86_400_000);
}

/**
 * The state of every door, 1 to 24. A door opens on its December day if its
 * level is released, and every released door is open from 25 December until
 * the next season. In test mode every released door is open.
 */
export function doorStates(date: CalendarDate, released: ReadonlySet<number>, testMode = false): DoorState[] {
  const season = seasonOf(date);
  const inAdvent = date.month === 12 && date.day <= DOOR_COUNT;
  return Array.from({ length: DOOR_COUNT }, (_, i): DoorState => {
    const door = i + 1;
    if (testMode) return released.has(door) ? 'open' : 'closed';
    if (season === null) return 'closed';
    if (inAdvent && door > date.day) return 'closed';
    return released.has(door) ? 'open' : 'coming-soon';
  });
}
