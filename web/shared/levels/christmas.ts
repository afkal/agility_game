import { Builder, type CourseLayout } from '../course.ts';

/**
 * Door 1, the original Christmas course: an easy start, then hurdles, tables,
 * gaps, the A-frame and snowballs, with candy canes that must not be touched
 * from the middle on, mixed more and more towards the finish.
 */
export function christmasCourse(): CourseLayout {
  const b = new Builder();
  b.flat(900, true);
  // Warm-up: single hurdles and a low table.
  b.hurdle();
  b.flat(500, true);
  b.hurdle();
  b.flat(400, false);
  b.table(350, 70);
  b.flat(500, true);
  b.checkpoint();
  // Gaps.
  b.gap(100);
  b.flat(500, true);
  b.hurdle();
  b.flat(400, false);
  b.gap(120);
  b.flat(600, true);
  b.checkpoint();
  // Table stairs.
  b.stairs(70, 140);
  b.flat(500, true);
  b.hurdle();
  b.flat(300, false);
  b.hurdle();
  b.flat(500, true);
  b.checkpoint();
  // First snowball and the A-frame.
  b.snowball();
  b.flat(400, false);
  b.aframe();
  b.flat(500, true);
  b.checkpoint();
  // Mixing it up, and the first candy cane.
  b.gap(110);
  b.flat(400, true);
  b.table(400, 90);
  b.cane();
  b.hurdle();
  b.flat(500, true);
  b.snowball();
  b.checkpoint();
  b.stairs(80, 160);
  b.flat(300, false);
  b.gap(130);
  b.flat(500, true);
  b.hurdle();
  b.flat(300, false);
  b.hurdle();
  b.flat(400, true);
  b.checkpoint();
  b.aframe();
  b.cane();
  b.gap(120);
  b.flat(400, true);
  b.snowball();
  b.hurdle();
  b.flat(500, true);
  b.checkpoint();
  // Final stretch.
  b.table(300, 100);
  b.flat(200, false);
  b.gap(130);
  b.flat(400, true);
  b.stairs(90, 170);
  b.cane();
  b.hurdle();
  b.cane();
  b.hurdle();
  b.flat(400, true);
  b.snowball();
  b.checkpoint();
  b.aframe();
  b.flat(400, true);
  b.gap(140);
  b.flat(600, true);
  b.finish();
  return b.build();
}
