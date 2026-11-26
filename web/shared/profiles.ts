// Rules for player names and dogs, shared by the registration form and the server.

export const DOG_IDS = ['elmo', 'laku', 'alma'] as const;
export type DogId = (typeof DOG_IDS)[number];

export const DEFAULT_DOG: DogId = 'elmo';

export const MAX_NAME_LENGTH = 20;

export interface Player {
  id: string;
  name: string;
  dog: DogId;
}

export interface LeaderboardEntry {
  name: string;
  dog: DogId;
  score: number;
}

export function isDogId(value: unknown): value is DogId {
  return typeof value === 'string' && (DOG_IDS as readonly string[]).includes(value);
}

/** The trimmed name if it is acceptable, otherwise null. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length >= 1 && [...name].length <= MAX_NAME_LENGTH ? name : null;
}
