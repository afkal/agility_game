// Guiding players to add the game to their home screen. Played from there it
// fills the screen like an app. On iPhone the home-screen game does not share
// what Safari remembers, so it is best installed before registering.

import { button, el } from '../dom.ts';
import { type Platform, platformOf } from './flow.ts';
import { formatPin } from './register.ts';

/** True when the game was opened from the home screen rather than in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const platform = (): Platform => platformOf(navigator.userAgent, navigator.maxTouchPoints);

/** Whether to guide this device to install: a phone or tablet browser tab. */
export function shouldGuideInstall(): boolean {
  return platform() !== 'other' && !isInstalled();
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Android Chrome offers its own install dialog; keep the offer until the player asks for it. */
let installPrompt: InstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
});

const SVG = 'http://www.w3.org/2000/svg';

/** The small icons iPhone uses for "Share" and "Add to Home Screen", for the steps. */
function icon(kind: 'share' | 'add'): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'install-icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute(
    'd',
    kind === 'share'
      ? 'M12 3v12M7.5 7.5 12 3l4.5 4.5M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17'
      : 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8',
  );
  svg.append(path);
  return svg;
}

function step(number: number, ...content: (string | Node)[]): HTMLElement {
  const item = el('li', 'install-step');
  item.append(el('span', 'install-number', String(number)), ...content);
  return item;
}

/** The steps for this device, as a list. */
function steps(): HTMLElement {
  const list = el('ol', 'install-steps');
  if (platform() === 'ios') {
    const share = el('span', '');
    share.append('Napauta Safarin alareunasta ', icon('share'), ' Jaa.');
    const add = el('span', '');
    add.append('Valitse ', icon('add'), ' Lisää Koti-valikkoon ja napauta Lisää.');
    list.append(step(1, share), step(2, add), step(3, 'Avaa peli kotivalikon Agility Camp -kuvakkeesta.'));
  } else {
    list.append(
      step(1, 'Napauta Chromen valikkoa ⋮ oikeasta yläkulmasta.'),
      step(2, 'Valitse Asenna sovellus tai Lisää aloitusnäyttöön.'),
      step(3, 'Avaa peli aloitusnäytön Agility Camp -kuvakkeesta.'),
    );
  }
  return list;
}

/** Android Chrome's own install button, when it offers one. */
function installButton(onInstalled: () => void): HTMLElement | null {
  if (!installPrompt) return null;
  const prompt = installPrompt;
  return button('primary', 'Asenna peli', async () => {
    await prompt.prompt();
    if ((await prompt.userChoice).outcome === 'accepted') {
      installPrompt = null;
      onInstalled();
    }
  });
}

/** The first screen on a phone browser: install first, or carry on in the browser. */
export function installScreen(onSkip: () => void): HTMLElement {
  const screen = el('div', 'screen install');
  const done = el('p', 'lead install-done');
  done.hidden = true;
  const showDone = () => {
    done.textContent = 'Peli on asennettu! Avaa se nyt aloitusnäytön kuvakkeesta.';
    done.hidden = false;
  };
  screen.append(
    el('h1', 'title', 'Agility Camp'),
    el('p', 'lead', 'Lisää peli ensin puhelimen kotivalikkoon, niin se aukeaa koko näytölle kuin oikea sovellus.'),
  );
  const android = platform() === 'android' ? installButton(showDone) : null;
  if (android) {
    screen.append(android, el('p', 'install-or', 'tai tee se itse:'));
  }
  screen.append(steps());
  if (platform() === 'ios') {
    // Inside WhatsApp's own browser there is no "Add to Home Screen": the link
    // has to go to Safari first.
    screen.append(
      el('p', 'install-tip', 'Eikö Lisää Koti-valikkoon -kohtaa löydy? Kopioi linkki ja liitä se Safarin osoiteriville.'),
      copyLinkButton(),
      done,
    );
  } else {
    screen.append(done, button('link-button', 'Jatka selaimessa ilman asennusta', onSkip));
  }
  return screen;
}

/** Copies the game's address, to paste into Safari. */
function copyLinkButton(): HTMLElement {
  const address = `${location.origin}/`;
  const copy = button('secondary', 'Kopioi linkki', async () => {
    try {
      await navigator.clipboard.writeText(address);
      copy.textContent = 'Linkki kopioitu! Liitä se Safariin.';
    } catch {
      // Some in-app browsers do not allow copying: show the address to copy by hand.
      copy.replaceWith(el('p', 'install-address', address));
    }
  });
  return copy;
}

/**
 * A reminder in the calendar for a player who registered in a browser tab. On
 * iPhone the installed game starts afresh, so it shows the code to sign in
 * with there.
 */
export function installReminder(pin: string, onClose: () => void): HTMLElement {
  const box = el('div', 'install-reminder');
  const text = el('div', '');
  text.append(el('strong', '', 'Lisää peli kotivalikkoon'));
  if (platform() === 'ios') {
    const note = el('p', '', 'Kotivalikon pelissä valitse "Oletko jo pelannut?" ja kirjoita PIN-koodisi ');
    note.append(el('strong', 'install-pin', formatPin(pin)), '.');
    text.append(note);
  }
  const details = el('details', 'install-details');
  details.append(el('summary', '', 'Näin se tehdään'), steps());
  text.append(details);
  const android = platform() === 'android' ? installButton(() => box.remove()) : null;
  if (android) text.append(android);
  box.append(text, button('install-close', '✕', onClose));
  box.querySelector('.install-close')?.setAttribute('aria-label', 'Sulje');
  return box;
}
