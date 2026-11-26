import { Builder, type CourseLayout } from '../course.ts';

/**
 * Door 1, the Christmas course: every obstacle of the game in four stretches
 * between flags, from single hurdles to snowmen, snowballs and branches, with
 * cookies high in the sky for those who master the second jump.
 */
export function christmasCourse(): CourseLayout {
  const b = new Builder();
  b.flat(900, true);
  // First stretch: hurdles, a gap and the first snowman.
  b.hurdle();
  b.flat(500, true);
  b.gap(100);
  b.flat(500, true);
  b.hurdle();
  b.flat(400, true);
  b.snowman();
  b.flat(500, true);
  b.checkpoint();
  // Second: branches, a gap, sky cookies and a table.
  b.branches();
  b.flat(400, true);
  b.gap(100);
  b.flat(500, true);
  b.skyCookies(600);
  b.table(350, 70);
  b.flat(400, true);
  b.checkpoint();
  // Third: the first snowball and the A-frame, then a hurdle and a snowman back to back.
  b.snowball();
  b.flat(400, false);
  b.aframe();
  b.flat(400, true);
  b.hurdle();
  b.snowman();
  b.flat(400, true);
  b.stairs(70, 140);
  b.flat(500, true);
  b.checkpoint();
  // Fourth: everything mixed.
  b.gap(120);
  b.flat(500, true);
  b.skyCookies(600);
  b.branches();
  b.hurdle();
  b.flat(400, true);
  b.table(400, 90);
  b.snowman();
  b.flat(500, true);
  b.checkpoint();
  // To the finish.
  b.snowball();
  b.hurdle();
  b.flat(400, true);
  b.gap(120);
  b.flat(400, true);
  b.snowman();
  b.flat(400, true);
  b.skyCookies(600);
  b.aframe();
  b.flat(500, true);
  b.finish();
  return b.build();
}
