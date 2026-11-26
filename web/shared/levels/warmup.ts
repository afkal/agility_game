import { Builder, type CourseLayout } from '../course.ts';

/**
 * The warm-up course for free practice, open all the time: only the basic
 * obstacles (hurdles, gaps, a gift-box table and the A-frame) with plenty of
 * room between them. The doors bring in the rest one by one.
 */
export function warmupCourse(): CourseLayout {
  const b = new Builder();
  b.flat(900, true);
  b.hurdle();
  b.flat(500, true);
  b.gap(100);
  b.flat(500, true);
  b.table(350, 70);
  b.flat(500, true);
  b.checkpoint();
  b.hurdle();
  b.flat(400, true);
  b.aframe();
  b.flat(400, true);
  b.gap(110);
  b.flat(500, true);
  b.hurdle();
  b.flat(500, true);
  b.finish();
  return b.build();
}
