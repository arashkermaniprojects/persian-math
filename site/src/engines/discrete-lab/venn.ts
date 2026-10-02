// Venn view of <kg-discrete-lab>: one to three set ovals inside the universal rectangle, element cards, shading,
// region counts, nested or separate ovals, and a flip into a two-way table. The drawing always runs left to right.
// Cards move three ways: drag them; tap a card, then tap the place; or pick a card and then a region button (keyboard).
import {
  countsToTable, exprRegions, labelAt, makeLayout, membersFrom, OUT, regionAt, setsOf, slots, toAscii, UNIVERSE_AT,
  type Layout, type Region,
} from '../lib/discrete-lab-sets';
import { esc, redraw, type Host, type View } from './dom';
import { twoWay } from './table';

type Val = string | number;

export interface VennConfig {
  /** Set names, single letters (default A, B). One, two or three sets. */
  sets?: string[];
  /** "overlap" (default), "apart", or "X⊆Y" (X drawn inside Y). */
  layout?: string;
  /** The learner chooses how to draw the ovals from these layouts. */
  layouts?: string[];
  /** Name of the universal set in the corner (default U); false = no name. */
  universe?: string | false;
  /** Element cards: numbers (locale digits) or keys (label item-<key>). */
  items?: Val[];
  /** Where cards start: one region for all ("out" = inside U, outside the ovals) or per card; the rest start in the tray. */
  place?: Region | Record<string, Region>;
  /** Cards cannot be moved. */
  lock?: boolean;
  /** The learner taps regions to shade them. */
  shade?: boolean;
  /** Regions shaded at the start (a set expression). */
  shaded?: string;
  /** Region counts instead of cards: true = the learner types every count; or per region a number (shown) or null (typed). */
  counts?: boolean | Record<Region, number | null>;
  /** A button flips the diagram into a two-way table of the same data and back (two sets). */
  toTable?: boolean;
}

const W = 360, H = 340, VB = `0 0 ${W} ${H}`;
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;

export function mount(host: Host, c: VennConfig): View {
  const sets = (c.sets ?? ['A', 'B']).slice(0, 3);
  const items = (c.items ?? []).map(String);
  const id = host.uid;
  let layout = c.layout ?? 'overlap';
  let L: Layout = makeLayout(sets, layout);
  let S = slots(L);
  const place: Record<string, Region | null> = Object.fromEntries(items.map((k) => [k, typeof c.place === 'string' ? c.place : c.place?.[k] ?? null]));
  const hasTray = items.some((k) => place[k] === null);
  /** Cards in the order they arrived, so each keeps its spot. */
  let order = [...items];
  let sel: string | null = null;
  let shaded = new Set<Region>(c.shaded ? exprRegions(c.shaded, L) : []);
  const countMode = !!c.counts;
  const given = typeof c.counts === 'object' ? c.counts : {};
  const counts: Record<Region, number | null> = {};
  let flipped = false;
  let drag: { k: string; x: number; y: number; el: HTMLElement; moved: boolean } | null = null;
  let dragged = false;
  const movable = !c.lock && items.length > 0 && !countMode;
  const root = document.createElement('div');
  root.className = 'kg-dl-vennv';

  const resetCounts = () => {
    for (const r of L.regions) counts[r] = typeof given[r] === 'number' ? given[r] : counts[r] ?? null;
  };
  resetCounts();

  const rname = (r: Region) => {
    if (r === OUT) return host.lbl('label-outside', 'outside');
    const ins = setsOf(r), s = ins.join(host.lbl('label-and', ' and '));
    return ins.length === L.sets.length || (L.kind === 'nest' && ins.length === 2) ? host.lbl('label-both', '{s}', { s }) : host.lbl('label-only', 'only {s}', { s });
  };
  const inside = (r: Region) => order.filter((k) => place[k] === r);
  const regionCounts = () => Object.fromEntries(L.regions.map((r) => [r, countMode ? counts[r] : inside(r).length]));

  // ---------- drawing ----------
  const defs = () => {
    const clip = sets.map((s) => {
      const k = L.circles[s];
      return `<clipPath id="${id}c${s}"><circle cx="${k.x}" cy="${k.y}" r="${k.r}"/></clipPath>`;
    }).join('');
    const masks = L.regions.map((r) => {
      const ex = sets.filter((s) => !setsOf(r).includes(s));
      return ex.length ? `<mask id="${id}m${r}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${ex.map((s) => {
        const k = L.circles[s];
        return `<circle cx="${k.x}" cy="${k.y}" r="${k.r}" fill="#000"/>`;
      }).join('')}</mask>` : '';
    }).join('');
    return `<defs>${clip}${masks}<pattern id="${id}h" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect class="hb" width="9" height="9"/><rect class="hl" width="3" height="9"/></pattern></defs>`;
  };
  /** One region filled: clipped to the sets it is in, masked by the ones it is not. */
  const fill = (r: Region, cls: string) => {
    const ins = setsOf(r);
    const m = ins.length < sets.length ? ` mask="url(#${id}m${r})"` : '';
    return ins.reduceRight((h, s) => `<g clip-path="url(#${id}c${s})">${h}</g>`, `<rect class="${cls}" width="${W}" height="${H}"${m}${cls === 'kg-dl-shade' ? ` fill="url(#${id}h)"` : ''}/>`);
  };
  const ovals = (lab = true) => sets.map((s) => {
    const k = L.circles[s], [x, y] = labelAt(L)[s];
    return `<circle class="kg-dl-oval o${sets.indexOf(s)}" cx="${k.x}" cy="${k.y}" r="${k.r}"/>` + (lab ? `<text class="kg-dl-sname" x="${x}" y="${y}">${esc(s)}</text>` : '');
  }).join('');

  const svg = () => {
    const u = c.universe === false ? '' : `<text class="kg-dl-uname" x="${UNIVERSE_AT[0]}" y="${UNIVERSE_AT[1]}">${esc(c.universe ?? 'U')}</text>`;
    return `<svg class="kg-dl-svg" viewBox="${VB}" aria-hidden="true">${defs()}<rect class="kg-dl-u" x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="10"/>` +
      [...shaded].filter((r) => L.regions.includes(r)).map((r) => fill(r, 'kg-dl-shade')).join('') + ovals() + u + '</svg>';
  };

  const cardHTML = (k: string, r: Region | null, pos?: [number, number]) => {
    const style = pos ? ` style="inset-inline-start:${pct(pos[0], W)};inset-block-start:${pct(pos[1], H)}"` : '';
    const name = host.item(k);
    if (!movable) return `<span class="kg-dl-card fixed"${style} aria-hidden="true">${name}</span>`;
    const where = r ? rname(r) : host.lbl('label-tray', 'cards');
    return `<button type="button" class="kg-dl-card${sel === k ? ' sel' : ''}" data-a="card" data-c="${esc(k)}" data-k="c${esc(k)}"${style} aria-pressed="${sel === k}" aria-label="${host.lbl('label-card', '{c}: {r}', { c: name, r: where })}">${name}</button>`;
  };

  /** Cards sit in the region's best places, read in order: smallest number top left (the drawing is LTR). */
  const byValue = (a: string, b: string) => (/^-?\d+$/.test(a) && /^-?\d+$/.test(b) ? +a - +b : a.localeCompare(b));
  const cardsInDiagram = () => L.regions.map((r) => {
    const cards = inside(r).sort(byValue), all = S[r] ?? [];
    const sl = all.slice(0, cards.length).sort((p, q) => Math.round((p[1] - q[1]) / 25) || p[0] - q[0]);
    return cards.map((k, i) => {
      const p = sl[i] ?? all[all.length - 1] ?? [W / 2, H / 2];
      const extra = i >= sl.length ? (i - sl.length + 1) * 8 : 0; // more cards than places: stack them a little
      return cardHTML(k, r, [p[0] + extra, p[1] + extra]);
    }).join('');
  }).join('');

  const countsInDiagram = () => L.regions.map((r) => {
    const p = S[r]?.[0] ?? [180, 150], style = `style="inset-inline-start:${pct(p[0], W)};inset-block-start:${pct(p[1], H)}"`;
    return typeof given[r] === 'number'
      ? `<span class="kg-dl-num" ${style}>${host.d(given[r]!)}</span>`
      : `<input class="kg-dl-cnt in" ${style} inputmode="numeric" autocomplete="off" data-r="${r}" data-k="n${r}" value="${counts[r] == null ? '' : host.d(counts[r]!)}" aria-label="${host.lbl('label-count', '{r}', { r: rname(r) })}">`;
  }).join('');

  /** A small picture of the drawing with one region filled (region buttons) or of a layout (layout buttons). */
  const mini = (r?: Region, LL = L) => {
    const keep = L;
    L = LL;
    const h = `<svg class="kg-dl-mini" viewBox="${VB}" aria-hidden="true"><rect class="kg-dl-u" x="6" y="6" width="${W - 12}" height="${H - 12}" rx="16"/>${r ? fill(r, 'kg-dl-on') : ''}${ovals(!r)}</svg>`;
    L = keep;
    return h;
  };

  const regionButtons = () => {
    if (!movable && !c.shade) return '';
    return `<div class="kg-dl-rbtns" role="group" aria-label="${host.lbl('label-regions', 'regions')}">${L.regions.map((r) => {
      const content = inside(r).map(host.item).join('، ');
      const lab = movable ? host.lbl('label-put', 'put it in {r}', { r: rname(r) }) : rname(r) + (content ? `: ${content}` : '');
      return `<button type="button" class="kg-dl-rbtn" data-a="region" data-r="${r}" data-k="r${r}"${c.shade && !movable ? ` aria-pressed="${shaded.has(r)}"` : ''}${movable && !sel ? ' aria-disabled="true"' : ''} aria-label="${lab}">${mini(r)}<span>${rname(r)}</span></button>`;
    }).join('')}</div>`;
  };

  const layoutButtons = () => !c.layouts?.length ? '' :
    `<div class="kg-dl-layouts" role="radiogroup" aria-label="${host.lbl('label-layout', 'how to draw the sets')}">${c.layouts.map((l) => {
      const m = /^(\w)\s*⊆\s*(\w)$/.exec(l);
      const name = m ? host.lbl('layout-inside', '{a} inside {b}', { a: m[1], b: m[2] }) : host.lbl(`layout-${l}`, l);
      return `<button type="button" role="radio" class="kg-dl-lay" data-a="layout" data-l="${esc(l)}" data-k="l${esc(l)}" aria-checked="${layout === l}">${mini(undefined, makeLayout(sets, l))}<span>${name}</span></button>`;
    }).join('')}</div>`;

  const render = () => {
    let h = '';
    if (flipped) {
      const t = countsToTable(regionCounts(), [sets[0], sets[1]]);
      const v = (k: string) => {
        const [r, col] = k.split(',');
        const rows = r === 't' ? [0, 1] : [+r], cols = col === 't' ? [0, 1] : [+col];
        const cells = rows.flatMap((i) => cols.map((j) => t[i][j]));
        return cells.some((x) => x == null) ? '?' : host.d(cells.reduce((a, b) => a! + b!, 0)!);
      };
      h += twoWay(host, [sets[0], `${sets[0]}′`], [sets[1], `${sets[1]}′`], v);
    } else {
      h += `<div class="kg-dl-dia${sel ? ' picking' : ''}${c.shade && !movable ? ' shading' : ''}" dir="ltr" data-a="dia">${svg()}${countMode ? countsInDiagram() : cardsInDiagram()}</div>`;
      if (movable && (items.some((k) => place[k] === null) || (hasTray && sel && place[sel]))) {
        const tray = order.filter((k) => place[k] === null).sort(byValue);
        h += `<div class="kg-dl-tray${sel && place[sel] ? ' drop' : ''}" role="group" data-a="tray" aria-label="${host.lbl('label-tray', 'cards')}">${tray.map((k) => cardHTML(k, null)).join('')}` +
          (sel && place[sel] ? `<button type="button" class="kg-dl-back" data-a="tray" data-k="back">${host.lbl('label-back', 'back to the cards')}</button>` : '') + '</div>';
      }
      h += layoutButtons() + regionButtons();
      // Fixed cards with no region buttons: say for screen readers what is in each region.
      if (!movable && !c.shade && items.length)
        h += `<ul class="kg-dl-sr">${L.regions.map((r) => `<li>${rname(r)}: ${inside(r).map(host.item).join('، ') || '–'}</li>`).join('')}</ul>`;
    }
    if (c.toTable && sets.length === 2) h += `<button type="button" class="kg-dl-flip" data-a="flip" data-k="flip" aria-pressed="${flipped}">${flipped ? host.lbl('label-diagram', 'Show the diagram') : host.lbl('label-table', 'Show as a table')}</button>`;
    redraw(root, h);
  };

  // ---------- actions ----------
  const move = (k: string, r: Region | null) => {
    if (r !== null && !L.regions.includes(r)) return;
    place[k] = r;
    order = [...order.filter((x) => x !== k), k];
    sel = null;
    host.say(host.lbl('label-moved', '{c}: {r}', { c: host.item(k), r: r ? rname(r) : host.lbl('label-tray', 'cards') }));
    render();
    root.querySelector<HTMLElement>(`[data-k="c${CSS.escape(k)}"]`)?.focus();
    host.changed();
  };
  const tapRegion = (r: Region) => {
    if (sel) return move(sel, r);
    if (movable) return host.say(host.lbl('label-pick-card', 'Pick a card first.'));
    if (!c.shade) return;
    if (shaded.has(r)) shaded.delete(r);
    else shaded.add(r);
    render();
    host.changed();
  };
  /** Point in diagram units from a pointer, or null if it is not over the drawing. */
  const at = (x: number, y: number): [number, number] | null => {
    const b = root.querySelector('.kg-dl-svg')?.getBoundingClientRect();
    if (!b || x < b.left || x > b.right || y < b.top || y > b.bottom) return null;
    return [((x - b.left) / b.width) * W, ((y - b.top) / b.height) * H];
  };

  root.addEventListener('click', (e) => {
    if (dragged) return void (dragged = false);
    const t = (e.target as Element).closest<HTMLElement>('[data-a]');
    if (!t) return;
    const a = t.dataset.a;
    if (a === 'card') {
      sel = sel === t.dataset.c ? null : t.dataset.c!;
      if (sel) host.say(host.lbl('label-selected', '{c}: now pick its place.', { c: host.item(sel) }));
      render();
    } else if (a === 'region') tapRegion(t.dataset.r!);
    else if (a === 'dia') {
      const p = at((e as MouseEvent).clientX, (e as MouseEvent).clientY), r = p && regionAt(L, p[0], p[1]);
      if (r && (sel || (c.shade && !movable))) tapRegion(r);
    } else if (a === 'tray' && sel) move(sel, null);
    else if (a === 'layout') {
      layout = t.dataset.l!;
      L = makeLayout(sets, layout);
      S = slots(L);
      for (const k of items) if (place[k] && !L.regions.includes(place[k]!)) place[k] = null;
      shaded = new Set([...shaded].filter((r) => L.regions.includes(r)));
      resetCounts();
      render();
      host.changed();
    } else if (a === 'flip') {
      flipped = !flipped;
      render();
    }
  });
  root.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'Escape' && sel) {
      sel = null;
      render();
    }
    const g = t.closest('[role="radiogroup"]'), step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (g && step) {
      const rs = [...g.querySelectorAll<HTMLElement>('[role="radio"]')];
      const n = rs[rs.indexOf(t) + step * (getComputedStyle(g).direction === 'rtl' ? -1 : 1)];
      if (n) (e.preventDefault(), n.click(), root.querySelector<HTMLElement>(`[data-k="${CSS.escape(n.dataset.k!)}"]`)?.focus());
    }
  });
  root.addEventListener('input', (e) => {
    const i = e.target as HTMLInputElement;
    if (!i.dataset.r) return;
    const v = toAscii(i.value.trim());
    counts[i.dataset.r] = /^\d+$/.test(v) ? +v : null;
    host.changed();
  });
  // Dragging a card: it follows the finger, and drops into the region under it (or back into the tray).
  root.addEventListener('pointerdown', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('.kg-dl-card[data-a="card"]');
    if (!t || !movable || e.button > 0) return;
    drag = { k: t.dataset.c!, x: e.clientX, y: e.clientY, el: t, moved: false };
    t.setPointerCapture?.(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    drag.el.classList.add('drag');
    drag.el.style.translate = `${dx}px ${dy}px`;
  });
  const end = (e: PointerEvent) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    dragged = true;
    setTimeout(() => (dragged = false), 0);
    const p = at(e.clientX, e.clientY), r = p && regionAt(L, p[0], p[1]);
    const tray = root.querySelector('.kg-dl-tray')?.getBoundingClientRect();
    const overTray = tray && e.clientY >= tray.top && e.clientY <= tray.bottom && e.clientX >= tray.left && e.clientX <= tray.right;
    if (r) move(d.k, r);
    else if (overTray) move(d.k, null);
    else render();
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', () => {
    drag = null;
    render();
  });
  render();

  return {
    root,
    state: () => ({
      regions: { ...place },
      members: membersFrom(place, sets),
      drawn: [...L.regions],
      shaded: [...shaded].filter((r) => L.regions.includes(r)),
      layout,
      ...(countMode ? { counts: { ...counts } } : {}),
    }),
  };
}
