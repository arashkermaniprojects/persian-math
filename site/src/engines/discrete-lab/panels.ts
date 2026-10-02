// Panels under any view of <kg-discrete-lab>: sets written in braces from a card tray ("A = { … }"), and statement
// rows answered with option buttons ("{۴} ☐ A" with ∈ / ⊆, "∅ ☐ {۰}" with = / ≠, or "finite / infinite").
import { parseOperand, relationHolds } from '../lib/discrete-lab-sets';
import type { SetsRow } from '../lib/discrete-lab-check';
import { setSep } from '../../lib/display';
import { esc, redraw, type Host, type View } from './dom';

type Val = string | number;
/** Label keys for the symbols' spoken names (sym-in = "is an element of", …): data-* names must be ASCII. */
const SYM: Record<string, string> = { '∈': 'in', '∉': 'notin', '⊆': 'sub', '⊄': 'notsub', '=': 'eq', '≠': 'neq' };

export interface WriteDef {
  /** What is written before "= { … }": a set name or an expression (A, A ∪ B, A′). The check's `written` uses this key. */
  key: string;
  /** Cards to write with (default: the mission's `tray`, else its `items`). Each can be tapped again and again. */
  tray?: Val[];
}

export interface RowDef {
  key: string;
  /** A relation "left ☐ right": an element (4), a set literal ({4}, {2, 4}, ∅) or a set name from `define`/the cards. */
  left?: string;
  right?: string;
  /** The buttons: symbols (∈ ∉ ⊆ ⊄ = ≠) for a relation, or label keys (opt-<key>) for a text row (label row-<key>). */
  options: string[];
  /** The right option for a text row; relation rows work out every option that makes them true. */
  answer?: string;
}

export interface PanelsConfig {
  /** Each set's elements, for statement rows (default: the elements from the cards). */
  define?: Record<string, Val[]>;
  write?: WriteDef[];
  tray?: Val[];
  items?: Val[];
  rows?: RowDef[];
}

export function mountPanels(host: Host, c: PanelsConfig, cards: () => Record<string, string[]>): View {
  const root = document.createElement('div');
  root.className = 'kg-dl-panels';
  const written: string[][] = (c.write ?? []).map(() => []);
  const picked: Record<string, string | null> = Object.fromEntries((c.rows ?? []).map((r) => [r.key, null]));
  const defs = () => (c.define ? Object.fromEntries(Object.entries(c.define).map(([k, v]) => [k, v.map(String)])) : cards());
  const truth = (r: RowDef) => {
    if (r.answer !== undefined || r.left === undefined) return r.answer !== undefined ? [r.answer] : [];
    const d = defs(), L = parseOperand(r.left, d), R = parseOperand(r.right ?? '', d);
    return r.options.filter((o) => relationHolds(L, o, R));
  };
  const sep = `<span class="kg-dl-sep" aria-hidden="true">${setSep({ digits: '', decimal: host.dataset.decimal ?? '.' })}</span>`;

  const writeHTML = (w: WriteDef, i: number) => {
    const tray = (w.tray ?? c.tray ?? c.items ?? []).map(String);
    const chips = written[i].map((v, j) =>
      `<button type="button" class="kg-dl-chip" data-a="unwrite" data-w="${i}" data-j="${j}" data-k="w${i}x${j}" aria-label="${host.lbl('label-unwrite', 'take out {c}', { c: host.item(v) })}">${host.item(v)}</button>`).join(sep);
    const label = host.lbl('label-write', '{k}', { k: w.key });
    return `<div class="kg-dl-write"><p class="kg-dl-braces" dir="ltr" aria-label="${label}">${host.math(w.key)}<span class="kg-dl-eq"> = {</span>${chips}<span class="kg-dl-eq">}</span></p>` +
      `<div class="kg-dl-wtray" role="group" aria-label="${host.lbl('label-tray', 'cards')}">${tray.map((v) =>
        `<button type="button" class="kg-dl-card" data-a="write" data-w="${i}" data-v="${esc(v)}" data-k="t${i}${esc(v)}" aria-label="${host.lbl('label-add', 'write {c}', { c: host.item(v) })}">${host.item(v)}</button>`).join('')}</div></div>`;
  };

  const rowHTML = (r: RowDef) => {
    const p = picked[r.key];
    const rel = r.left !== undefined;
    const st = rel
      ? `<p class="kg-dl-st" dir="ltr">${host.math(r.left!)}<span class="kg-dl-slot${p ? ' on' : ''}">${p ? esc(p) : '?'}</span>${host.math(r.right ?? '')}</p>`
      : `<p class="kg-dl-st">${host.text(host.lbl(`row-${r.key}`, r.key))}</p>`;
    const name = rel ? host.d(`${esc(r.left!)} ? ${esc(r.right ?? '')}`) : host.lbl(`row-${r.key}`, r.key);
    return `<div class="kg-dl-row${rel ? '' : ' txt'}">${st}<div class="kg-dl-opts${rel ? ' sym' : ''}" role="radiogroup" aria-label="${name}">${r.options.map((o) =>
      `<button type="button" role="radio" class="kg-dl-opt" data-a="pick" data-r="${esc(r.key)}" data-o="${esc(o)}" data-k="o${esc(r.key)}${esc(o)}" aria-checked="${p === o}"` +
      `${rel ? ` aria-label="${host.lbl(`sym-${SYM[o] ?? o}`, o)}"` : ''}>${rel ? esc(o) : host.lbl(`opt-${o}`, o)}</button>`).join('')}</div></div>`;
  };

  const render = () => redraw(root, (c.write ?? []).map(writeHTML).join('') + (c.rows?.length ? `<div class="kg-dl-rows">${c.rows.map(rowHTML).join('')}</div>` : ''));

  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-a]');
    if (!b || !root.contains(b)) return;
    const { a, w, j, v, r, o } = b.dataset;
    if (a === 'write') written[+w!].push(v!);
    else if (a === 'unwrite') written[+w!].splice(+j!, 1);
    else if (a === 'pick') picked[r!] = o!;
    else return;
    render();
    if (a === 'unwrite') root.querySelectorAll<HTMLElement>(`[data-w="${w}"][data-a="unwrite"]`)[+j!]?.focus()
      ?? root.querySelector<HTMLElement>(`[data-w="${w}"][data-a="write"]`)?.focus();
    host.changed();
  });
  // Arrow keys move along a row of options, in the page direction (symbols run left to right).
  root.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement, g = t.closest('[role="radiogroup"]');
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!g || !step) return;
    const rs = [...g.querySelectorAll<HTMLElement>('[role="radio"]')];
    const n = rs[rs.indexOf(t) + step * (getComputedStyle(g).direction === 'rtl' ? -1 : 1)];
    if (n) {
      e.preventDefault();
      n.click();
      root.querySelector<HTMLElement>(`[data-k="${CSS.escape(n.dataset.k!)}"]`)?.focus();
    }
  });
  render();

  return {
    root,
    state: () => {
      const s: { written?: Record<string, string[]>; rows?: SetsRow[] } = {};
      if (c.write) s.written = Object.fromEntries(c.write.map((w, i) => [w.key, [...written[i]]]));
      if (c.rows) s.rows = c.rows.map((r) => ({ key: r.key, picked: picked[r.key], truth: truth(r) }));
      return s;
    },
  };
}
