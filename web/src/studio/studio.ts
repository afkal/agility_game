// The outfit studio (/asustestudio, development server only): move, scale and
// turn each item on each dog, then save the placements into the project.

import { DOG_IDS, type DogId } from '../../shared/profiles.ts';
import { ITEMS, NO_PLACEMENT, type Outfit, type Placement, type Placements, SLOT_NAMES, itemById } from '../../shared/wardrobe.ts';
import { PLACEMENTS } from '../../shared/wardrobe-placement.ts';
import { dogLook } from '../game/dogs.ts';
import { button, el } from '../dom.ts';
import { dogPicture } from '../ui/dogPicture.ts';
import './studio.css';

/** The stage shows a little more than the menus do, so items can be moved off the dog and back. */
const STAGE_VIEW = { x: -60, y: -72, size: 124 };
const STAGE_VIEWBOX = `${STAGE_VIEW.x} ${STAGE_VIEW.y} ${STAGE_VIEW.size} ${STAGE_VIEW.size}`;
/** Items shown with the chosen one when "show the rest of the outfit" is on. */
const CONTEXT_OUTFIT: Outfit = { neck: 'collar', head: 'santa-hat' };

export function startStudio(root: HTMLElement): void {
  const placements: Placements = structuredClone(PLACEMENTS);
  let dog: DogId = 'elmo';
  let itemId = ITEMS[0]!.id;
  let showRest = true;
  let unsaved = false;

  const page = el('div', 'studio');
  const stageBox = el('div', 'studio-stage-box');
  const controls = el('div', 'studio-controls');
  const previews = el('div', 'studio-previews');
  const status = el('p', 'studio-status');
  page.append(el('h1', 'studio-title', 'Asustestudio'), el('div', 'studio-main'), previews);
  page.querySelector('.studio-main')!.append(stageBox, controls);
  root.replaceChildren(page);

  const current = (): Placement => placements[itemId]?.[dog] ?? { ...NO_PLACEMENT };
  const setCurrent = (change: Partial<Placement>) => {
    const next = { ...current(), ...change };
    placements[itemId] = { ...placements[itemId], [dog]: next };
    unsaved = true;
    draw();
  };

  /** The chosen item, with the collar and hat around it when asked for. */
  const outfitFor = (): Outfit => {
    const item = itemById(itemId)!;
    return { ...(showRest ? CONTEXT_OUTFIT : {}), [item.slot]: item.id };
  };

  // Controls that stay in place while the picture redraws.
  const dogRow = el('div', 'studio-row');
  const itemList = el('div', 'studio-items');
  const sliders = el('div', 'studio-sliders');
  const slider = (label: string, min: number, max: number, step: number, key: keyof Placement) => {
    const wrap = el('label', 'studio-slider');
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const value = el('span', 'studio-value');
    input.addEventListener('input', () => setCurrent({ [key]: Number(input.value) }));
    wrap.append(el('span', '', label), input, value);
    sliders.append(wrap);
    return { input, value };
  };
  const dxSlider = slider('Vaaka', -40, 40, 0.5, 'dx');
  const dySlider = slider('Pysty', -40, 40, 0.5, 'dy');
  const scaleSlider = slider('Koko', 0.3, 2.5, 0.01, 'scale');
  const rotationSlider = slider('Kierto', -90, 90, 1, 'rotation');

  const rest = el('label', 'studio-check');
  const restBox = el('input');
  restBox.type = 'checkbox';
  restBox.checked = showRest;
  restBox.addEventListener('change', () => {
    showRest = restBox.checked;
    draw();
  });
  rest.append(restBox, el('span', '', 'Näytä panta ja lakki mukana'));

  const actions = el('div', 'studio-row');
  actions.append(
    button('studio-button', 'Nollaa', () => setCurrent({ ...NO_PLACEMENT })),
    button('studio-button', 'Kopioi muille koirille', () => {
      const p = current();
      placements[itemId] = Object.fromEntries(DOG_IDS.map((d) => [d, { ...p }]));
      unsaved = true;
      draw();
    }),
    button('studio-button studio-save', 'Tallenna', () => void save()),
  );

  controls.append(
    el('h2', '', 'Koira'),
    dogRow,
    el('h2', '', 'Varuste'),
    itemList,
    el('h2', '', 'Paikka'),
    el('p', 'studio-hint', 'Raahaa varustetta kuvassa. Nuolet siirtävät (Shift: enemmän), + ja − muuttavat kokoa, Q ja E kääntävät.'),
    sliders,
    rest,
    actions,
    status,
  );

  async function save(): Promise<void> {
    status.textContent = 'Tallennetaan…';
    try {
      const res = await fetch('/__studio/placements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(placements),
      });
      if (!res.ok) throw new Error(String(res.status));
      unsaved = false;
      status.textContent = 'Tallennettu tiedostoon shared/wardrobe-placement.ts.';
    } catch {
      status.textContent = 'Tallennus epäonnistui. Onko kehityspalvelin käynnissä?';
    }
  }

  function draw(): void {
    dogRow.replaceChildren(
      ...DOG_IDS.map((d) =>
        button(`studio-button${d === dog ? ' chosen' : ''}`, dogLook(d).name, () => {
          dog = d;
          draw();
        }),
      ),
    );
    itemList.replaceChildren(
      ...ITEMS.map((item) => {
        const moved = DOG_IDS.some((d) => placements[item.id]?.[d]);
        const label = `${item.look(dog).name}${item.day ? ` · ${item.day}` : ''} · ${SLOT_NAMES[item.slot]}${moved ? ' ✓' : ''}`;
        return button(`studio-button${item.id === itemId ? ' chosen' : ''}`, label, () => {
          itemId = item.id;
          draw();
        });
      }),
    );

    const p = current();
    for (const [s, key] of [
      [dxSlider, 'dx'],
      [dySlider, 'dy'],
      [scaleSlider, 'scale'],
      [rotationSlider, 'rotation'],
    ] as const) {
      s.input.value = String(p[key]);
      s.value.textContent = key === 'scale' ? p[key].toFixed(2) : String(p[key]);
    }

    const stage = dogPicture(dog, outfitFor(), 'studio-stage', placements, STAGE_VIEWBOX);
    for (const group of stage.querySelectorAll<SVGGElement>('g[data-item]')) {
      if (group.dataset.item !== itemId) group.classList.add('studio-dim');
    }
    attachDrag(stage);
    stageBox.replaceChildren(stage);

    previews.replaceChildren(
      ...DOG_IDS.map((d) => {
        const card = el('div', 'studio-preview');
        card.append(dogPicture(d, outfitFor(), 'studio-preview-dog', placements), el('span', '', dogLook(d).name));
        return card;
      }),
    );
    status.textContent = unsaved ? 'Tallentamattomia muutoksia.' : status.textContent;
  }

  /** Dragging on the stage moves the item by the same distance in picture units. */
  function attachDrag(stage: SVGSVGElement): void {
    stage.addEventListener('pointerdown', (event) => {
      const start = { x: event.clientX, y: event.clientY, p: current() };
      const unitsPerPixel = STAGE_VIEW.size / stage.getBoundingClientRect().width;
      stage.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => {
        const dx = Math.round((start.p.dx + (e.clientX - start.x) * unitsPerPixel) * 2) / 2;
        const dy = Math.round((start.p.dy + (e.clientY - start.y) * unitsPerPixel) * 2) / 2;
        const next = { ...current(), dx, dy };
        placements[itemId] = { ...placements[itemId], [dog]: next };
        unsaved = true;
        // Only the stage needs redrawing while dragging.
        const fresh = dogPicture(dog, outfitFor(), 'studio-stage', placements, STAGE_VIEWBOX);
        for (const group of fresh.querySelectorAll<SVGGElement>('g[data-item]')) {
          if (group.dataset.item !== itemId) group.classList.add('studio-dim');
        }
        stage.replaceChildren(...fresh.childNodes);
      };
      const end = () => {
        stage.removeEventListener('pointermove', move);
        draw();
      };
      stage.addEventListener('pointermove', move);
      stage.addEventListener('pointerup', end, { once: true });
      stage.addEventListener('pointercancel', end, { once: true });
    });
    stage.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        setCurrent({ scale: Math.max(0.3, Math.min(2.5, current().scale * (event.deltaY < 0 ? 1.03 : 1 / 1.03))) });
      },
      { passive: false },
    );
  }

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return;
    const step = event.shiftKey ? 2 : 0.5;
    const p = current();
    const changes: Record<string, Partial<Placement>> = {
      ArrowLeft: { dx: p.dx - step },
      ArrowRight: { dx: p.dx + step },
      ArrowUp: { dy: p.dy - step },
      ArrowDown: { dy: p.dy + step },
      '+': { scale: Math.min(2.5, p.scale + 0.02) },
      '-': { scale: Math.max(0.3, p.scale - 0.02) },
      q: { rotation: p.rotation - 1 },
      e: { rotation: p.rotation + 1 },
    };
    const change = changes[event.key];
    if (!change) return;
    event.preventDefault();
    setCurrent(change);
  });
  window.addEventListener('beforeunload', (event) => {
    if (unsaved) event.preventDefault();
  });

  draw();
}
