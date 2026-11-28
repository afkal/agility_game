import { describe, expect, it } from 'vitest';
import { viewHeight } from './viewport.ts';

describe('view height', () => {
  it('shows the whole world on a screen as narrow as the world', () => {
    expect(viewHeight(1280, 800)).toBe(800);
    expect(viewHeight(1024, 768)).toBe(800);
  });

  it('cuts sky on a wide phone screen so the course fills the width', () => {
    expect(viewHeight(844, 390)).toBe(591);
  });

  it('never cuts more than the jump room above the highest table', () => {
    expect(viewHeight(2400, 800)).toBe(560);
  });
});
