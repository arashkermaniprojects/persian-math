// <kg-place-value>: base-ten blocks, the Afghan «چوت» abacus or place-value counters, with a place-value table.
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options"). The columns always run highest place → ones
// left to right, in every locale, as the numbers are written (both countries' books put the ones on the right).
// A place may hold 10–19 for a while: ten loose ones are bundled into a ten (and a ten broken into ones) with
// the exchange buttons, as on the abacus in AF_G02_riazi.pdf p.61 [۵۴].
import { digitsOf } from '../lib/display';
import {
  bundle, countsOf, defaultView, firstDiff, groupThrees, isCanonical, romanSymbol, separatorFor, shift, toRoman,
  unbundle, valueOf,
} from './lib/place-value-math';

type View = 'blocks' | 'abacus' | 'counters';

export interface PlaceValueConfig {
  /** Lowest and highest place shown, as powers of ten (0 = ones, 1 = tens, −1 = tenths). Default 0 and the start number's highest place (at least tens). */
  minPlace?: number;
  maxPlace?: number;
  /** Start number, shown with one digit per place, e.g. 32 or "3.45". */
  value?: number | string;
  /** Start counts per place, lowest place first; may exceed 9, e.g. [14] = fourteen loose ones. Overrides value. */
  counts?: number[];
  /** 'auto' (default): the abacus for fa-AF and ps, blocks elsewhere. Blocks go up to thousands; other places use counters. */
  view?: 'auto' | View;
  /** Views the learner may switch between. Default blocks + abacus when view is auto, none otherwise. */
  views?: View[];
  /** Display only: no buttons. */
  locked?: boolean;
  /** Show the bundle (10 → 1) and break (1 → 10) buttons. Default true. */
  exchange?: boolean;
  /** Most items one place may hold (default 19). */
  max?: number;
  /** Show the place-value table (a digit under each column). Default true. */
  table?: boolean;
  /** Show the number written out: 'number' (grouped in threes), 'roman', 'both'. Default none. */
  readout?: 'number' | 'roman' | 'both';
  /** Counters carry I, X, C, M (Roman column symbols). */
  roman?: boolean;
  /** Head the columns with their class: ones, thousands, millions (labels class-0, class-1, class-2…). */
  classes?: boolean;
  /** Places to outline. */
  highlight?: number[];
  /** Rounding: outline this place and mark the next lower place as the one to look at. */
  round?: number;
  /** A second, fixed number shown above for comparing. */
  compare?: number | string;
  /** With compare: outline the highest place where the two numbers differ. */
  highlightDiff?: boolean;
  /** × 10 and ÷ 10 buttons: every digit slides one place. */
  shift?: boolean;
  /** Key of a picture-first hint: shows the matching button's icon with the text label instruction-<key>. */
  instruction?: 'add' | 'sub' | 'bundle' | 'break' | 'shift' | 'read' | string;
}

const EN = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions', 'ten millions', 'hundred millions', 'billions'];
const EN_DEC = ['tenths', 'hundredths', 'thousandths'];
const ICON: Record<View, string> = {
  blocks: '<svg viewBox="0 0 24 24"><path d="M3 4h4v16H3zM10 12h4v4h-4zM16 16h4v4h-4zM10 16h4v4h-4z"/></svg>',
  abacus: '<svg viewBox="0 0 24 24"><path d="M2 20h20v2H2zM7 2v18M17 2v18" stroke="currentColor" stroke-width="1.6"/><ellipse cx="7" cy="17.5" rx="3.6" ry="1.8"/><ellipse cx="7" cy="14" rx="3.6" ry="1.8"/><ellipse cx="17" cy="17.5" rx="3.6" ry="1.8"/></svg>',
  counters: '<svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="4"/><circle cx="17" cy="8" r="4"/><circle cx="12" cy="17" r="4"/></svg>',
};

export class PlaceValue extends HTMLElement {
  private cfg: PlaceValueConfig = {};
  private lo = 0;
  private n = 2;
  private counts: number[] = [];
  private ref?: number[];
  private view: View = 'blocks';
  private exchanges = 0;
  private slide = 0;
  private said = '';

  constructor() {
    super();
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>('button[data-act]');
      if (b && !b.disabled) this.act(b.dataset.act!, Number(b.dataset.i), b.dataset.v as View);
    });
  }

  set config(c: PlaceValueConfig) {
    this.cfg = c;
    const lo = (this.lo = c.minPlace ?? 0);
    const top = (v: number | string | undefined) => (v === undefined ? 0 : String(v).split('.')[0].replace(/^0+/, '').length - 1);
    const hi = c.maxPlace ?? Math.max(1, lo + 1, top(c.value), top(c.compare), lo + (c.counts?.length ?? 0) - 1);
    this.n = hi - lo + 1;
    this.counts = c.counts ? Array.from({ length: this.n }, (_, i) => c.counts![i] ?? 0) : countsOf(c.value ?? 0, lo, this.n);
    this.ref = c.compare === undefined ? undefined : countsOf(c.compare, lo, this.n);
    this.view = c.view && c.view !== 'auto' ? c.view : defaultView(document.documentElement.lang);
    this.exchanges = 0;
    this.render();
  }

  get state() {
    return { value: valueOf(this.counts, this.lo), counts: this.counts.slice(), canonical: isCanonical(this.counts), exchanges: this.exchanges, view: this.view };
  }

  private get max() { return this.cfg.max ?? 19; }
  private d(x: number | string) { return digitsOf(x, { digits: this.dataset.digits ?? '0123456789', decimal: '.' }); }
  private place(p: number) {
    return (p < 0 ? this.dataset['placeM' + -p] ?? EN_DEC[-p - 1] : this.dataset['place' + p] ?? EN[p] ?? `10^${p}`).replace(/"/g, '&quot;');
  }
  private lbl(key: string, fb: string, p = 0) {
    return (this.dataset[key] ?? fb).replace(/"/g, '&quot;').replace('{p}', this.place(p)).replace('{q}', this.place(p + (key === 'labelBundle' ? 1 : -1)));
  }

  private act(a: string, i: number, v: View) {
    const c = this.counts, before = c.slice();
    let next: number[] | null = null;
    if (a === 'view') { this.view = v; return this.render('view'); }
    if (a === 'add' && c[i] < this.max) (next = c.slice())[i]++;
    else if (a === 'sub' && c[i] > 0) (next = c.slice())[i]--;
    else if (a === 'up') next = bundle(c, i, this.max);
    else if (a === 'down') next = unbundle(c, i, this.max);
    else if (a === 'x10' || a === 'd10') { next = shift(c, a === 'x10' ? 1 : -1); this.slide = a === 'x10' ? 1 : -1; }
    if (!next) return;
    if (a === 'up' || a === 'down') this.exchanges++;
    this.counts = next;
    // Say what changed, for screen readers: "1 ten, 4 ones".
    this.said = next.map((x, j) => (x !== before[j] ? `${this.d(x)} ${this.place(this.lo + j)}` : '')).filter(Boolean).reverse().join(', ');
    this.render(a, i);
    this.slide = 0;
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  /** Items drawn in one column: blocks, beads or counters, in tens (a full ten gets a dashed loop: "bundle me"). */
  private items(p: number, k: number): string {
    const v = this.view === 'abacus' ? 'b' : this.view === 'blocks' && p >= 0 && p <= 3 ? 'urfk'[p] : 't';
    const sym = v === 't' && this.cfg.roman ? romanSymbol(p) : '';
    let s = '';
    for (let g = 0; g < k; g += 10) {
      const m = Math.min(10, k - g);
      s += `<span class="kg-pv-g${m === 10 && k > 9 ? ' full' : ''}">${`<i class="kg-pv-${v}">${sym}</i>`.repeat(m)}</span>`;
    }
    return s;
  }

  private row(counts: number[], locked: boolean, hl: Set<number>): string {
    const { lo, n, cfg } = this;
    const cols = Array.from({ length: n }, (_, j) => n - 1 - j); // highest place first (leftmost)
    const cls = (i: number) => {
      const p = lo + i;
      return `${hl.has(p) ? ' hl' : ''}${cfg.round !== undefined && p === cfg.round - 1 ? ' look' : ''}${cfg.classes && p > 0 && p % 3 === 0 ? ' edge' : ''}`;
    };
    let s = '';
    if (cfg.classes) {
      // Class headings (ones, thousands, millions) over runs of three places.
      for (let j = 0; j < n;) {
        const p = lo + cols[j], k = p < 0 ? -1 : Math.floor(p / 3);
        let span = 0;
        while (j < n && (lo + cols[j] < 0 ? -1 : Math.floor((lo + cols[j]) / 3)) === k) { j++; span++; }
        s += `<div class="kg-pv-class" style="grid-column:span ${span}">${k < 0 ? '' : this.dataset['class' + k] ?? ['ones', 'thousands', 'millions', 'billions'][k]}</div>`;
      }
    }
    for (const i of cols)
      s += `<div class="kg-pv-vis${cls(i)}" role="img" aria-label="${this.d(counts[i])} ${this.place(lo + i)}">${this.items(lo + i, counts[i])}</div>`;
    if (this.view === 'abacus') s += '<div class="kg-pv-base"></div>';
    for (const i of cols) s += `<div class="kg-pv-lab${cls(i)}" dir="auto">${this.place(lo + i)}</div>`;
    if (cfg.table !== false)
      for (const i of cols)
        s += `<div class="kg-pv-cell${cls(i)}${counts[i] > 9 ? ' over' : ''}"${lo < 0 && lo + i === 0 ? ` data-mark="${this.dataset.decimal ?? '.'}"` : ''}>${this.d(counts[i])}</div>`;
    if (!locked)
      for (const i of cols) {
        const b = (act: string, html: string, label: string, ok: boolean) =>
          `<button type="button" class="kg-pv-${act}" data-act="${act}" data-i="${i}" aria-label="${label}"${ok ? '' : ' disabled'}>${html}</button>`;
        s += `<div class="kg-pv-ctl">${b('add', '+', this.lbl('labelAdd', 'Add one: {p}', lo + i), counts[i] < this.max)}${b('sub', '−', this.lbl('labelRemove', 'Take away one: {p}', lo + i), counts[i] > 0)}`;
        if (cfg.exchange !== false) {
          if (i < n - 1) s += b('up', this.glyph('up'), this.lbl('labelBundle', 'Make 10 {p} into 1 {q}', lo + i), !!bundle(counts, i, this.max));
          if (i > 0) s += b('down', this.glyph('down'), this.lbl('labelBreak', 'Break 1 {p} into 10 {q}', lo + i), !!unbundle(counts, i, this.max));
        }
        s += '</div>';
      }
    const slide = this.slide ? ` slide${this.slide > 0 ? 'l' : 'r'}` : '';
    return `<div class="kg-pv-row${locked ? ' locked' : ''}${slide}" dir="ltr" role="group" style="--pv-n:${n}">${s}</div>`;
  }

  /** Button faces, also shown as the picture in an instruction hint. */
  private glyph(k: string): string {
    const t = this.d(10);
    return k === 'up' ? `<b>←</b><small>${t}</small>` : k === 'down' ? `<small>${this.d(1)}</small><b>→</b>` : k === 'x10' ? `×${t}` : `÷${t}`;
  }

  private render(focus?: string, fi?: number) {
    const { cfg } = this;
    const hl = new Set([...(cfg.highlight ?? []), ...(cfg.round !== undefined ? [cfg.round] : [])]);
    if (this.ref && cfg.highlightDiff) {
      const i = firstDiff(this.ref, this.counts);
      if (i >= 0) hl.add(this.lo + i);
    }
    let s = '';
    const ins = cfg.instruction;
    if (ins) {
      const chip = { add: '+', sub: '−', bundle: this.glyph('up'), break: this.glyph('down'), shift: this.glyph('x10') }[ins] ??
        '<svg viewBox="0 0 24 24"><path d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>';
      const key = 'instruction' + ins[0].toUpperCase() + ins.slice(1);
      s += `<p class="kg-pv-ins"><span class="kg-pv-chip" aria-hidden="true">${chip}</span><span>${this.dataset[key] ?? this.dataset.instruction ?? ''}</span></p>`;
    }
    const views = cfg.views ?? (cfg.view && cfg.view !== 'auto' ? [] : (['blocks', 'abacus'] as View[]));
    if (views.length > 1)
      s += `<div class="kg-pv-views" role="group" aria-label="${this.dataset.labelViews ?? 'View'}">${views
        .map((v) => `<button type="button" data-act="view" data-v="${v}" aria-pressed="${v === this.view}" aria-label="${this.dataset['label' + v[0].toUpperCase() + v.slice(1)] ?? v}">${ICON[v]}</button>`)
        .join('')}</div>`;
    if (this.ref) s += this.row(this.ref, true, hl);
    s += this.row(this.counts, !!cfg.locked, hl);
    if (cfg.shift && !cfg.locked)
      s += `<div class="kg-pv-shift">${(['x10', 'd10'] as const)
        .map((a) => `<button type="button" data-act="${a}" aria-label="${this.dataset[a === 'x10' ? 'labelTimes10' : 'labelDivide10'] ?? (a === 'x10' ? 'Multiply by 10' : 'Divide by 10')}"${shift(this.counts, a === 'x10' ? 1 : -1) ? '' : ' disabled'}>${this.glyph(a)}</button>`)
        .join('')}</div>`;
    const ro = cfg.readout;
    if (ro) {
      const v = valueOf(this.counts, this.lo);
      const num = this.d(groupThrees(v, this.dataset.separator ?? separatorFor(this.dataset.decimal ?? '.')).replace('.', this.dataset.decimal ?? '.'));
      s += `<p class="kg-pv-out" aria-label="${this.dataset.labelNumber ?? 'Number'}">${ro !== 'roman' ? `<bdi dir="ltr">${num}</bdi>` : ''}${ro !== 'number' ? `<bdi dir="ltr" class="kg-pv-roman">${toRoman(Number(v)) || '–'}</bdi>` : ''}</p>`;
    }
    s += `<p class="kg-pv-live" aria-live="polite">${this.said}</p>`;
    const wrap = document.createElement('div');
    wrap.className = 'kg-pv';
    wrap.dataset.view = this.view;
    if (/^fa-IR/.test(document.documentElement.lang)) wrap.dataset.tie = ''; // Iran: «دسته‌های ده‌تایی», tied bundles
    wrap.innerHTML = s;
    this.replaceChildren(wrap);
    if (focus) {
      // Keep keyboard focus on the button just used (or its column's + if it is now disabled).
      const q = (sel: string) => wrap.querySelector<HTMLButtonElement>(`${sel}:not([disabled])`);
      const at = Number.isNaN(fi) ? '' : `[data-i="${fi}"]`;
      (q(focus === 'view' ? '[aria-pressed=true]' : `[data-act="${focus}"]${at}`) ?? q(`[data-act=add]${at}`))?.focus();
    }
  }
}

customElements.define('kg-place-value', PlaceValue);
