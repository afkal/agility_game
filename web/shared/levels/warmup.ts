import { Builder, type CourseLayout } from '../course.ts';

/**
 * The warm-up course, open before the calendar starts and all through it: a
 * short tour of everything the doors use, one at a time with room to breathe.
 */
export function warmupCourse(): CourseLayout {
  const b = new Builder();
  b.flat(900, true);
  b.hurdle();
  b.flat(500, true);
  b.snowman();
  b.flat(500, true);
  b.checkpoint();
  b.branches();
  b.flat(400, true);
  b.gap(100);
  b.flat(500, true);
  b.table(350, 70);
  b.flat(400, true);
  b.checkpoint();
  b.snowball();
  b.flat(400, false);
  b.aframe();
  b.flat(400, true);
  b.hurdle();
  b.snowman();
  b.flat(400, true);
  b.branches();
  b.flat(500, true);
  b.finish();
  return b.build();
}
