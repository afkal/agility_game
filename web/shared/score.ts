/** Points for each gingerbread cookie collected. */
export const POINTS_PER_COOKIE = 10;
/** Points for each heart still left at the finish. */
export const POINTS_PER_HEART = 50;

/** The score of a finished run. */
export function score(gingerbread: number, hearts: number): number {
  return gingerbread * POINTS_PER_COOKIE + hearts * POINTS_PER_HEART;
}
