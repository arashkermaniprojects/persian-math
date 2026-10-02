// The `intervals` module of <kg-number-line>, loaded only by missions whose setup has `intervals` (or `module: intervals`):
//   pieces  shaded segments and rays on the line; each finite end is a dot the learner drags, and taps to switch between
//           filled (included, ≤ ≥) and hollow (not included, < >). Buttons choose ray ← / segment / ray → and the dot kind.
//   given   reference sets drawn as thin bands above the line (e.g. two inequalities whose common part is asked).
//   readout the drawn set as inequalities and/or interval notation, live (`notation`; Iran/Afghanistan show [a, b), UK
//           inequalities only: `auto` takes the studio's engine label `notation`).
//   test    a test point above the line for an inequality: drag it and see whether the inequality holds there.
//   signs   sign rows under the line for a product or quotient of linear factors: zeros filled, poles hollow, + / − per
//           cell (filled in by the learner, or shown).
// Pure logic and the `interval` check: engines/lib/number-line-intervals.ts. Options: docs/STUDIOS.md (number-line).
import type { NumberLine } from '../number-line';
import { criticalPoints, holds, inequalityTexts, intervalText, numText, parseIneq, pieceOf, signTable, zeroOf, type Ineq, type Piece, type Sign } from '../lib/number-line-intervals';

type Kind = 'left' | 'segment' | 'right';
type Spec = string | { from?: number | null; to?: number | null; open?: boolean | [boolean, boolean] };
export interface IntervalsConfig {
  /** Pieces drawn at the start: "[-2, 4)", "(3, inf)" or { from, to, open }. */
  start?: Spec[];
  /** How many pieces the learner may have (default 1; 0 = picture only). Tapping the line adds one. */
  max?: number;
  /** The start pieces cannot be changed. */
  lock?: boolean;
  /** Shapes offered by the buttons (default all three). */
  kinds?: Kind[];
  /** Shape of a piece added by tapping the line (default segment). */
  add?: Kind;
  /** Reference sets drawn above the line: a string or { set, tone (0–5) }. */
  given?: (string | { set: string; tone?: number })[];
  /** Live readout of the drawn set (default none). */
  notation?: 'auto' | 'interval' | 'inequality' | 'both' | 'none';
  /** The letter in the inequalities (default x). */
  variable?: string;
  /** A test point for an inequality: "2x - 1 < 7" or { ineq, at }. */
  test?: string | { ineq: string; at?: number };
  /** Sign rows: numerator and denominator factors, each linear ("x - 1"); `result` = the last row's caption;
   *  `edit` = which rows the learner fills: true (all), 'result', false (all shown). */
  signs?: { num: string[]; den?: string[]; result?: string; edit?: boolean | 'result' };
}

/** What the engine calls on its module. */
export interface NlPart {
  root: HTMLElement;
  /** Extra room above the line (px). */
  top: number;
  /** The learner can change something. */
  live: boolean;
  draw(out: string[], y: number): number;
  down(e: PointerEvent): boolean;
  move(e: PointerEvent): boolean;
  up(): void;
  key(e: KeyboardEvent): boolean;
  focused(): SVGElement | null;
  after(): void;
  state(): Record<string, unknown>;
}

/** A piece in tick indices; null = an infinite end. */
interface P { a: number | null; b: number | null; open: [boolean, boolean]; lock?: boolean }
const HIT = 22;
const SIGN: Record<Sign, string> = { '+': '+', '-': '−', '': '?' };
/** "2x - 1" → "2x − 1" (spaced binary signs, − for -). */
const expr = (s: string) => s.replace(/\s+/g, '').replace(/([\w)])([+-])/g, '$1 $2 ').replace(/-/g, '−');

export function mountIntervals(host: NumberLine, cfg: IntervalsConfig): NlPart {
  const d = host.dataset;
  const lab = (k: string, fb: string) => d[k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] ?? fb;
  const den = host.den, f = host.fmt, v = cfg.variable ?? 'x';
  const tick = (n: number) => Math.round(n * den);
  const toP = (p: Piece, lock?: boolean): P => ({ a: p.from === null ? null : tick(p.from), b: p.to === null ? null : tick(p.to), open: [...p.open] as [boolean, boolean], lock });
  const pcs: P[] = (cfg.start ?? []).flatMap((s) => pieceOf(s).map((p) => toP(p, cfg.lock)));
  const max = Math.max(cfg.max ?? 1, pcs.length);
  const kinds: Kind[] = cfg.kinds ?? ['left', 'segment', 'right'];
  const given = (cfg.given ?? []).map((g, k) => (typeof g === 'string' ? { set: g, tone: k } : { tone: k, ...g }))
    .map((g) => ({ tone: g.tone, ps: pieceOf(g.set).map((p) => toP(p)) }));
  const test = cfg.test && (typeof cfg.test === 'string' ? { ineq: cfg.test } : cfg.test);
  const q: Ineq | null = test ? parseIneq(test.ineq, v) : null;
  let probe = test ? Math.min(host.hi, Math.max(host.lo, tick(test.at ?? 0))) : 0;
  const tested = new Set<number>();
  // sign rows
  const sg = cfg.signs, facs = sg ? [...sg.num, ...(sg.den ?? [])] : [];
  const want = sg ? signTable(facs, v) : [];
  const cps = sg ? criticalPoints(facs, v) : [];
  const poles = sg ? (sg.den ?? []).map((s) => zeroOf(s, v)) : [];
  const zeros = sg ? sg.num.map((s) => zeroOf(s, v)) : [];
  const editRow = (r: number) => !!sg && (sg.edit === true || (sg.edit === 'result' && r === want.length - 1));
  const cells: Sign[][] = want.map((row, r) => row.map((s) => (editRow(r) ? '' : s)));
  const editable = !cfg.lock || max > pcs.length;
  const live = editable || !!q || (!!sg && !!sg.edit);

  let act: { p: number; e: 0 | 1 } | null = pcs.length && !pcs[0].lock ? { p: 0, e: pcs[0].a === null ? 1 : 0 } : null;
  let drag: { kind: 'h' | 'probe'; moved: boolean } | null = null;
  let fkey = ''; // data-k of the element with keyboard focus

  // ---------------------------------------------------------------- controls under the line
  const root = document.createElement('div');
  root.className = 'kg-nl-iv';
  const btn = (cls: string, label: string, html: string) => `<button type="button" class="kg-nl-b ${cls}" aria-label="${label}" title="${label}">${html}</button>`;
  const ICON: Record<Kind, string> = {
    left: '<path d="M2 12h26M2 12l7-6M2 12l7 6"/><circle cx="30" cy="12" r="4"/>',
    segment: '<circle cx="6" cy="12" r="4"/><path d="M6 12h24"/><circle cx="30" cy="12" r="4"/>',
    right: '<circle cx="6" cy="12" r="4"/><path d="M6 12h26M34 12l-7-6M34 12l-7 6"/>',
  };
  if (editable) {
    root.innerHTML =
      `<div class="kg-nl-row" dir="ltr" role="group" aria-label="${lab('label-shape', 'Shape')}">` +
      kinds.map((k) => btn(`kind" data-kind="${k}`, lab(`label-${k}`, k), `<svg viewBox="0 0 36 24" aria-hidden="true">${ICON[k]}</svg>`)).join('') + '</div>' +
      `<div class="kg-nl-row" role="group" aria-label="${lab('label-end', 'End')}">` +
      btn('end" data-open="0', lab('label-closed', 'Filled: included'), `<span class="kg-nl-ico"></span>${lab('label-closed', 'Filled: included')}`) +
      btn('end" data-open="1', lab('label-open', 'Hollow: not included'), `<span class="kg-nl-ico open"></span>${lab('label-open', 'Hollow: not included')}`) + '</div>' +
      (max > 1 || !pcs.length ? `<div class="kg-nl-row">${btn('add secondary', lab('label-add-piece', 'Add a piece'), '+ ' + lab('label-add-piece', 'Add a piece'))}` +
        (max > 1 ? btn('del secondary', lab('label-remove-piece', 'Remove'), lab('label-remove-piece', 'Remove')) : '') + '</div>' : '');
  }
  const read = document.createElement('p');
  read.className = 'kg-nl-read';
  read.setAttribute('aria-live', 'polite');
  const tline = document.createElement('p');
  tline.className = 'kg-nl-test';
  tline.setAttribute('aria-live', 'polite');
  root.append(read, tline);

  const changed = () => { host.render(); host.changed(); };
  const span = () => Math.max(host.step, Math.round((host.hi - host.lo) / 5 / host.step) * host.step);
  const clampT = (t: number) => Math.min(host.hi, Math.max(host.lo, t));

  function make(kind: Kind, t: number, open = false): P {
    if (kind === 'right') return { a: t, b: null, open: [open, true] };
    if (kind === 'left') return { a: null, b: t, open: [true, open] };
    const w = span();
    return t + w <= host.hi ? { a: t, b: t + w, open: [open, false] } : { a: t - w, b: t, open: [false, open] };
  }
  const kindOf = (p: P): Kind => (p.a === null ? 'left' : p.b === null ? 'right' : 'segment');
  const endAt = (p: P, e: 0 | 1) => (e ? p.b : p.a);

  function add(t: number) {
    pcs.push(make(cfg.add ?? 'segment', t));
    const p = pcs[pcs.length - 1];
    act = { p: pcs.length - 1, e: p.a === t ? 0 : 1 };
    fkey = `h${act.p}-${act.e}`;
  }
  function moveEnd(t: number) {
    if (!act) return false;
    const p = pcs[act.p];
    t = clampT(t);
    if (endAt(p, act.e) === t) return false;
    if (act.e) p.b = t; else p.a = t;
    if (p.a !== null && p.b !== null && p.a > p.b) {
      // the ends crossed: swap them so a ≤ b, and keep holding the same dot
      [p.a, p.b] = [p.b, p.a];
      p.open = [p.open[1], p.open[0]];
      act.e = act.e ? 0 : 1;
    }
    fkey = `h${act.p}-${act.e}`;
    return true;
  }
  function toggle() {
    if (!act) return;
    pcs[act.p].open[act.e] = !pcs[act.p].open[act.e];
    changed();
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.kind && act) {
      const p = pcs[act.p], t = endAt(p, act.e)!, n = make(b.dataset.kind as Kind, t, p.open[act.e]);
      pcs[act.p] = n;
      act = { p: act.p, e: n.a === t ? 0 : 1 };
    } else if (b.dataset.open && act) pcs[act.p].open[act.e] = b.dataset.open === '1';
    else if (b.classList.contains('add') && pcs.length < max) add(clampT(tick(0)));
    else if (b.classList.contains('del') && act && !pcs[act.p].lock) {
      pcs.splice(act.p, 1);
      const i = pcs.findIndex((p) => !p.lock);
      act = i >= 0 ? { p: i, e: pcs[i].a === null ? 1 : 0 } : null;
    } else return;
    changed();
  });

  // ---------------------------------------------------------------- drawing
  const X = (t: number | null, e: 0 | 1) => (t === null ? (e ? host.x1 + 10 : host.x0 - 10) : host.x(t));
  function band(p: P, yy: number, cls: string, r: number, handles: number) {
    const xa = X(p.a, 0), xb = X(p.b, 1), o: string[] = [`<line class="${cls}" x1="${xa}" x2="${xb}" y1="${yy}" y2="${yy}"/>`];
    for (const [x, s] of [[xa, -1], [xb, 1]] as const)
      if ((s < 0 ? p.a : p.b) === null) o.push(`<path class="${cls} head" d="M${x + s * 4} ${yy}l${-s * 12} -8v16z"/>`);
    ([0, 1] as const).forEach((e) => {
      const t = endAt(p, e);
      if (t === null) return;
      const x = host.x(t), dot = `<circle class="kg-nl-end${p.open[e] ? ' open' : ''}${r < 9 ? ' g' : ''}" cx="${x}" cy="${yy}" r="${r}"/>`;
      if (handles < 0) return o.push(dot);
      const k = `h${handles}-${e}`, on = act?.p === handles && act.e === e;
      o.push(`<g class="kg-nl-h${on ? ' active' : ''}" data-h="${handles}-${e}" data-k="${k}" tabindex="0" role="slider" ` +
        `aria-label="${lab('label-end', 'End')} ${host.text(t)}" aria-valuenow="${t / den}" aria-valuetext="${host.text(t)} (${lab(p.open[e] ? 'label-open' : 'label-closed', p.open[e] ? 'open' : 'closed')})">` +
        `<circle class="kg-nl-hit" cx="${x}" cy="${yy}" r="${HIT}"/>${dot}</g>`);
    });
    return o.join('');
  }

  function draw(out: string[], y: number): number {
    given.forEach((g, k) => g.ps.forEach((p) => out.push(band(p, y - 22 - 14 * k - (q ? 46 : 0), `kg-nl-given t${g.tone ?? k}`, 5, -1))));
    pcs.forEach((p, i) => out.push(band(p, y, 'kg-nl-band', 9, p.lock ? -1 : i)));
    if (q) {
      const x = host.x(probe), ok = holds(q, probe / den).ok;
      out.push(`<g class="kg-nl-probe ${ok ? 'ok' : 'no'}" data-probe="1" data-k="probe" tabindex="0" role="slider" aria-label="${lab('label-test', 'Test a number')}" ` +
        `aria-valuenow="${probe / den}" aria-valuetext="${host.text(probe)}"><circle class="kg-nl-hit" cx="${x}" cy="${y - 30}" r="${HIT}"/>` +
        `<path d="M${x - 9} ${y - 40}h18l-9 14z"/><line x1="${x}" x2="${x}" y1="${y - 26}" y2="${y - 4}"/></g>`);
    }
    if (!sg) return 0;
    // sign rows: a caption, then one cell per gap between the critical points
    const bx = [host.x0 - 8, ...cps.map((c) => host.x(c * den)), host.x1 + 8];
    let top = y + 52;
    for (const c of cps) out.push(`<line class="kg-nl-crit" x1="${host.x(c * den)}" x2="${host.x(c * den)}" y1="${y + 8}" y2="${top + 66 * want.length - 2}"/>`);
    want.forEach((row, r) => {
      const res = r === want.length - 1;
      const cap = res ? sg.result ?? (sg.den?.length ? `${sg.num.map((s) => `(${expr(s)})`).join('')} ÷ ${sg.den.map((s) => `(${expr(s)})`).join('')}` : sg.num.map((s) => `(${expr(s)})`).join('')) : expr(facs[r]);
      out.push(`<text class="kg-nl-cap" x="${host.x0 - 8}" y="${top + 12}">${cap.replace(/[0-9]/g, (c) => f.digits[+c])}</text>`);
      row.forEach((_, i) => {
        const x = bx[i], w = bx[i + 1] - x, s = cells[r][i], ed = editRow(r);
        const body = `<rect class="kg-nl-cell${res ? ' res' : ''}" x="${x + 1}" y="${top + 18}" width="${w - 2}" height="44" rx="6"/>` +
          `<text class="kg-nl-sign${s ? '' : ' blank'}" x="${x + w / 2}" y="${top + 47}">${s || ed ? SIGN[s] : ''}</text>`;
        out.push(ed ? `<g class="kg-nl-c" data-c="${r}-${i}" data-k="c${r}-${i}" tabindex="0" role="button" aria-label="${cap} ${lab('label-cell', 'cell')} ${f.digits[(i + 1) % 10]}: ${s ? SIGN[s] : '?'}">${body}</g>` : body);
      });
      // a factor is 0 at its own zero; the result row marks zeros (filled) and poles (hollow)
      const z = !res && zeroOf(facs[r], v);
      if (z !== false && z !== null) out.push(`<text class="kg-nl-zero" x="${host.x(z * den)}" y="${top + 47}">${f.digits[0]}</text>`);
      if (res) {
        for (const p of zeros) if (p !== null && !poles.includes(p)) out.push(`<circle class="kg-nl-end" cx="${host.x(p * den)}" cy="${top + 40}" r="7"/>`);
        for (const p of poles) if (p !== null) out.push(`<circle class="kg-nl-end open" cx="${host.x(p * den)}" cy="${top + 40}" r="7"/>`);
      }
      top += 66;
    });
    return top;
  }

  function after() {
    const p = act && pcs[act.p];
    root.querySelectorAll<HTMLButtonElement>('button[data-kind]').forEach((b) => {
      b.disabled = !p;
      b.setAttribute('aria-pressed', String(!!p && kindOf(p) === b.dataset.kind));
    });
    root.querySelectorAll<HTMLButtonElement>('button[data-open]').forEach((b) => {
      b.disabled = !p;
      b.setAttribute('aria-pressed', String(!!p && p.open[act!.e] === (b.dataset.open === '1')));
    });
    root.querySelectorAll<HTMLButtonElement>('.add').forEach((b) => (b.hidden = pcs.length >= max));
    root.querySelectorAll<HTMLButtonElement>('.del').forEach((b) => (b.disabled = !p));
    const mode = cfg.notation === 'auto' ? (d.notation ?? 'both') : cfg.notation ?? 'none';
    const set = pieces();
    const ineq = `<span>${set.length ? inequalityTexts(set, f, v).map((s) => `<bdi dir="ltr">${s.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</bdi>`).join(` ${lab('label-or', 'or')} `) : '—'}</span>`;
    const iv = `<span><bdi dir="ltr">${intervalText(set, f)}</bdi></span>`;
    read.innerHTML = mode === 'inequality' ? ineq : mode === 'interval' ? iv : mode === 'both' ? ineq + iv : '';
    read.hidden = mode === 'none';
    if (q) {
      const h = holds(q, probe / den), n = (x: number) => numText(x, f);
      tline.className = `kg-nl-test ${h.ok ? 'ok' : 'no'}`;
      tline.innerHTML = `<bdi dir="ltr">${v} = ${n(probe / den)} → ${n(h.l)} ${q.rel.replace('<', '&lt;').replace('>', '&gt;')} ${n(h.r)}</bdi> ` +
        `<b>${h.ok ? '✓' : '✗'}</b> ${lab(h.ok ? 'label-true' : 'label-false', h.ok ? 'true' : 'false')}`;
    }
    tline.hidden = !q;
  }

  function pieces(): Piece[] {
    return pcs.map((p) => ({ from: p.a === null ? null : p.a / den, to: p.b === null ? null : p.b / den, open: [...p.open] as [boolean, boolean] }));
  }

  // ---------------------------------------------------------------- input
  function down(e: PointerEvent): boolean {
    if (!live) return false;
    const t = e.target as Element;
    const h = t.closest('[data-h]'), c = t.closest('[data-c]');
    if (c) {
      const [r, i] = c.getAttribute('data-c')!.split('-').map(Number);
      cells[r][i] = cells[r][i] === '' ? '+' : cells[r][i] === '+' ? '-' : '';
      fkey = `c${r}-${i}`;
      changed();
    } else if (t.closest('[data-probe]')) drag = { kind: 'probe', moved: false };
    else if (h) {
      const [p, en] = h.getAttribute('data-h')!.split('-').map(Number);
      act = { p, e: en as 0 | 1 };
      fkey = `h${p}-${en}`;
      drag = { kind: 'h', moved: false };
      host.render();
    } else if (t.closest('.kg-nl-track') && editable) {
      const x = host.xToTick(e);
      if (pcs.length < max) add(x);
      else moveEnd(x);
      drag = { kind: 'h', moved: true }; // keep dragging the dot just placed
      changed();
    } else return false;
    e.preventDefault();
    host.svg.setPointerCapture?.(e.pointerId);
    return true;
  }
  function move(e: PointerEvent): boolean {
    if (!drag) return false;
    const t = host.xToTick(e);
    if (drag.kind === 'probe') {
      if (t !== probe) { probe = t; tested.add(t / den); drag.moved = true; changed(); }
    } else if (moveEnd(t)) { drag.moved = true; changed(); }
    return true;
  }
  function up() {
    // a tap on a dot (no drag) switches it between filled and hollow
    if (drag?.kind === 'h' && !drag.moved) toggle();
    if (drag?.kind === 'probe') tested.add(probe / den);
    drag = null;
  }
  function key(e: KeyboardEvent): boolean {
    const t = e.target as Element, k = e.key, st = host.step;
    const delta: Record<string, number> = { ArrowRight: st, ArrowUp: st, ArrowLeft: -st, ArrowDown: -st, PageUp: Math.max(den, st), PageDown: -Math.max(den, st) };
    if (t.hasAttribute('data-probe')) {
      if (!(k in delta)) return false;
      probe = Math.min(host.hi, Math.max(host.lo, probe + delta[k]));
      tested.add(probe / den);
      fkey = 'probe';
    } else if (t.hasAttribute('data-h')) {
      const [p, en] = t.getAttribute('data-h')!.split('-').map(Number);
      act = { p, e: en as 0 | 1 };
      fkey = `h${p}-${en}`;
      if (k in delta) moveEnd(endAt(pcs[p], act.e)! + delta[k]);
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); return toggle(), true; }
      else if ((k === 'Delete' || k === 'Backspace') && max > 1) { pcs.splice(p, 1); act = null; fkey = ''; }
      else return false;
    } else if (t.hasAttribute('data-c')) {
      const [r, i] = t.getAttribute('data-c')!.split('-').map(Number);
      const next: Record<string, Sign> = { '+': '+', '-': '-', '−': '-', Delete: '', Backspace: '' };
      if (k in next) cells[r][i] = next[k];
      else if (k === 'Enter' || k === ' ') cells[r][i] = cells[r][i] === '' ? '+' : cells[r][i] === '+' ? '-' : '';
      else return false;
      fkey = `c${r}-${i}`;
    } else return false;
    e.preventDefault();
    changed();
    return true;
  }

  return {
    root, live, top: (q ? 46 : 0) + (given.length ? 14 * given.length + 8 : 0),
    draw, down, move, up, key, after,
    focused: () => (fkey ? host.svg.querySelector<SVGElement>(`[data-k="${fkey}"]`) : null),
    state: () => ({
      intervals: pieces(),
      ...(sg ? { signs: { cells: cells.map((r) => [...r]), want } } : {}),
      ...(q ? { tested: [...tested].sort((a, b) => a - b) } : {}),
    }),
  };
}
