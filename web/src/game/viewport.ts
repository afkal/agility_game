// Keeps the game sized to what the phone actually shows.
//
// After the phone is turned, mobile Chrome sometimes leaves the page zoomed
// in, so a fixed full-screen element is larger than the visible area and the
// course is cut off until the player pinches out. Sizing the game from the
// visual viewport keeps it fitting the screen whatever the zoom is.

const SETTLE_DELAYS_MS = [100, 400, 1000];

/**
 * Size `root` to the visible area and call `onResize` whenever that changes,
 * including a few times after a rotation while the browser settles.
 * Returns a function that stops following the viewport.
 */
export function followVisibleViewport(root: HTMLElement, onResize: () => void): () => void {
  const visual = window.visualViewport;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const apply = () => {
    if (visual) {
      root.style.left = `${visual.offsetLeft}px`;
      root.style.top = `${visual.offsetTop}px`;
      root.style.width = `${visual.width}px`;
      root.style.height = `${visual.height}px`;
    }
    onResize();
  };

  const afterRotate = () => {
    apply();
    for (const delay of SETTLE_DELAYS_MS) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        apply();
      }, delay);
      timers.add(timer);
    }
  };

  visual?.addEventListener('resize', apply);
  visual?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', afterRotate);
  apply();

  return () => {
    visual?.removeEventListener('resize', apply);
    visual?.removeEventListener('scroll', apply);
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', afterRotate);
    for (const timer of timers) clearTimeout(timer);
  };
}

const isPhone = () => window.matchMedia('(pointer: coarse)').matches;

/**
 * On phones, go full screen in landscape on the player's first touch, so the
 * browser's address bar no longer takes room from the course. Browsers that
 * do not allow it (such as Safari on iPhone) simply stay as they are.
 */
export function enterFullscreen(): void {
  if (!isPhone() || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => {});
}

export function exitFullscreen(): void {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}
