// <kg-chart-builder>: collect data into a tally / frequency table, then build and read pictograms, bar charts,
// line graphs and pie charts. All SVG, no libraries. Contract: docs/STUDIOS.md ("Engine contract", "Engine options").
// Charts run left → right with values going up (or right) in every locale; tables follow the page direction
// (docs/NOTATION.md "Charts").
// Extension point: on-demand modules (chart-builder/<name>.ts, e.g. `summary`) plug in through MODULES / ChartModule.
import { digitsOf } from '../lib/display';
import { asciiDigits } from '../lib/fraction';
import { lerp, level, mean, niceStep, paintedValues, paintFrom, sectorPath, slices, snapTo, symbols, tallyGroups, ticks, twoLines } from './lib/chart-builder-model';

type Kind = 'pictogram' | 'bar' | 'line' | 'pie';
type Show = 'edit' | 'show' | 'hide';
interface Cat { key: string; icon?: string; color?: string }

export interface ChartBuilderConfig {
  /** Category keys (label = studio engine label `cat-<key>`), or { key, icon, color }. */
  categories?: (string | Cat)[];
  /** Picture for every category without its own (pictogram symbol, survey cards). */
  icon?: string;
  /** Survey: one card per answer (category keys). The learner tallies every card. */
  data?: string[];
  /** `sort` (default): tap a card, then the row it belongs in. `auto`: tapping a card tallies it in its own row. */
  collect?: 'sort' | 'auto';
  /** Frequency table: tally column, count column («تعداد»), total row. `head` names the first column (label `head-<head>`). */
  table?: { tally?: Show; count?: Show; total?: boolean; head?: string };
  /** Starting tally marks per category. */
  tally?: number[];
  /** The data (counts per category): shown in the count column and drawn by read-only charts. */
  values?: number[];
  chart?: Kind;
  /** The learner builds the chart from `start` (default all 0). Pie: paints the `sectors`. */
  edit?: boolean;
  start?: number[];
  /** Pictogram: one symbol stands for `key`. Pie with `sectors`: one sector stands for `key`. */
  key?: number;
  /** Pictogram: smallest piece of a symbol the learner can draw (1 whole, 2 halves, 4 quarters). Default 2 when key is even. */
  part?: number;
  /** Pictogram layout: `rows` (default, a column of the table) or `columns`. */
  orient?: 'rows' | 'columns';
  /** Value axis (bar, line; pictogram max). */
  min?: number;
  max?: number;
  step?: number;
  /** Bars and points move in steps of `snap` (default 1). */
  snap?: number;
  /** Axis titles: [category axis, value axis] → labels `axis-<key>`. */
  axes?: [string?, string?];
  /** Words after the key, e.g. "children" → label `unit-children` ("☺ = 2 children"). */
  unit?: string;
  /** Pie: number of equal sectors (Iranian G3 draws 8, 10 or 12). */
  sectors?: number;
  /** The learner taps a category as the answer (most, least, mode). */
  pick?: boolean;
  /** The learner chooses a chart type («انتخاب نمودار»). */
  choose?: Kind[];
  /** Levelling bars for the mean: lowering a bar puts units in the hand, raising one takes them back. */
  level?: boolean;
  /** Dashed line at the mean of the values. */
  meanLine?: boolean;
  /** Icon hint above the engine + label `instruction-<name>` (sort, tally, count, build, drag, paint, pick, choose, level). */
  instruction?: string;
  /** An on-demand module (see MODULES), e.g. `summary`; its options sit under a key of the same name. */
  module?: string;
}

/** What the engine offers a module. */
export interface ChartHost extends HTMLElement {
  readonly width: number;
  /** Engine label (`label-x` → dataset.labelX), or `fb`. */
  L(k: string, fb?: string): string;
  /** A number in the locale's digits and decimal mark. */
  num(n: number): string;
  /** Tell the studio something changed (and redraw when `render`). */
  changed(render?: boolean): void;
}
/** What an on-demand module (chart-builder/<name>.ts) plugs into the engine. Elements it draws carry `data-k` (a
 *  stable key, so focus survives a redraw); `data-a` clicks the engine does not know go to `act` (prefix a module's
 *  actions, e.g. `s-card`, so they never meet the engine's own: card, add, del, less, more, brush, sector, pick, kind). */
export interface ChartModule {
  /** HTML drawn after the engine's own table and chart. */
  html(): string;
  /** A click on a [data-a] element the engine does not handle; true = changed (redraw + kg-change). */
  act?(t: HTMLElement): boolean;
  /** A key pressed inside the engine; true = handled. */
  key?(e: KeyboardEvent): boolean;
  /** Pointer down not on an engine slider; true = the module took it (then move/up follow). */
  down?(e: PointerEvent): boolean;
  move?(e: PointerEvent): void;
  up?(): void;
  /** An input or select of the module changed; true = changed (kg-change, no redraw). */
  input?(t: HTMLInputElement | HTMLSelectElement): boolean;
  /** Merged into the engine state (e.g. { summary: {...} }). */
  state(): Record<string, unknown>;
}
type ModuleLoader = () => Promise<{ mount(host: ChartHost, cfg: ChartBuilderConfig): ChartModule }>;
/** On-demand modules, loaded only when a mission's setup names them (each its own chunk). Planned: grouped. */
export const MODULES: Record<string, ModuleLoader> = {
  summary: () => import('./chart-builder/summary'),
};

const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['blue', 'orange', 'green', 'purple', 'red', 'yellow', 'pink', 'brown'];
/** 24×24 pictures. `d` = detail drawn in the card colour, `s` = stroke in the symbol colour. */
const ICONS: Record<string, string> = {
  face: '<circle cx="12" cy="12" r="10"/><path class="d" d="M8 14.5q4 4 8 0M8.5 8.5v2M15.5 8.5v2"/>',
  apple: '<path d="M12 7C9 5 4 6 4 12s4 10 8 8c4 2 8-3 8-8s-5-7-8-5z"/><path class="s" d="M12 7q0-3 3-5"/>',
  banana: '<path d="M5 3q-2 13 9 16 5 1 7-2-10 0-13-14z"/>',
  orange: '<circle cx="12" cy="13" r="9"/><path class="d" d="M12 6v3"/>',
  grapes: '<circle cx="7" cy="7" r="3.3"/><circle cx="12" cy="7" r="3.3"/><circle cx="17" cy="7" r="3.3"/><circle cx="9.5" cy="12.5" r="3.3"/><circle cx="14.5" cy="12.5" r="3.3"/><circle cx="12" cy="18" r="3.3"/>',
  flower: '<circle cx="12" cy="6" r="4.3"/><circle cx="6" cy="11" r="4.3"/><circle cx="18" cy="11" r="4.3"/><circle cx="8.5" cy="18" r="4.3"/><circle cx="15.5" cy="18" r="4.3"/><circle class="o" cx="12" cy="12.5" r="3"/>',
  sun: '<circle cx="12" cy="12" r="5.5"/><path class="s" d="M12 1v4M12 19v4M1 12h4M19 12h4M4 4l3 3M17 17l3 3M20 4l-3 3M7 17l-3 3"/>',
  leaf: '<path d="M3 21C3 10 10 3 21 3c0 11-7 18-18 18z"/><path class="d" d="M6 18L15 9"/>',
  snow: '<path class="s" d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/>',
  star: '<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"/>',
  square: '<rect x="3" y="3" width="18" height="18" rx="3"/>',
  house: '<path d="M12 3L2 12h3v9h14v-9h3z"/>',
  book: '<path d="M3 4h7q2 0 2 2v15q0-2-2-2H3zM21 4h-7q-2 0-2 2v15q0-2 2-2h7z"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path class="d" d="M12 2v20M2 12h20"/>',
  tree: '<circle cx="12" cy="9" r="7"/><rect x="10.5" y="14" width="3" height="8"/>',
};
/** Small pictures of each chart type, for «انتخاب نمودار». */
const KINDS: Record<Kind, string> = {
  pictogram: '<circle cx="8" cy="24" r="4"/><circle cx="8" cy="14" r="4"/><circle cx="20" cy="24" r="4"/><circle cx="32" cy="24" r="4"/><circle cx="32" cy="14" r="4"/><circle cx="32" cy="4" r="4"/>',
  bar: '<path class="ax" d="M2 2v28h36"/><rect x="7" y="14" width="7" height="16"/><rect x="18" y="6" width="7" height="24"/><rect x="29" y="18" width="7" height="12"/>',
  line: '<path class="ax" d="M2 2v28h36"/><path class="ln" d="M7 22L15 12 23 16 33 5"/><circle cx="7" cy="22" r="2.5"/><circle cx="15" cy="12" r="2.5"/><circle cx="23" cy="16" r="2.5"/><circle cx="33" cy="5" r="2.5"/>',
  pie: '<circle class="pb" cx="20" cy="16" r="14"/><path d="M20 16V2a14 14 0 0 1 14 14z"/>',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const svg = (w: number, h: number, body: string, cls = '', extra = '') =>
  `<svg xmlns="${NS}" class="${cls}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${extra}>${body}</svg>`;
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export class ChartBuilder extends HTMLElement {
  private cfg: ChartBuilderConfig = { categories: [] };
  private cats: Cat[] = [];
  private tal: number[] = [];
  private typed: (number | null)[] = [];
  private vals: number[] = [];
  private paint: number[] = [];
  private pool = 0;
  private picked: string | null = null;
  private kind: Kind | null = null;
  /** Survey cards: the row each was put in (-1 = not yet), the selected card, and per row the cards in it (-1 = a free mark). */
  private used: number[] = [];
  private sel = -1;
  private marks: number[][] = [];
  private brush = 0;
  private drag = -1;
  width = 340;
  private say = '';
  private ro?: ResizeObserver;
  private built = false;
  private mod?: ChartModule;
  private gen = 0;
  ready: Promise<void> = Promise.resolve();

  set config(c: ChartBuilderConfig) {
    this.cfg = c;
    this.cats = (c.categories ?? []).map((k, i) => {
      const o = typeof k === 'string' ? { key: k } : k;
      return { ...o, icon: o.icon ?? c.icon ?? 'square', color: o.color ?? COLORS[i % COLORS.length] };
    });
    const n = this.cats.length;
    const z = () => Array(n).fill(0);
    this.tal = c.tally?.slice() ?? z();
    this.marks = this.tal.map((t) => Array(t).fill(-1));
    this.typed = Array(n).fill(null);
    this.used = (c.data ?? []).map(() => -1);
    this.sel = -1;
    this.pool = 0;
    this.picked = this.kind = null;
    this.brush = 0;
    if (c.chart === 'pie' && c.sectors) this.paint = c.edit ? Array(c.sectors).fill(-1) : paintFrom(c.values ?? [], c.sectors, this.key);
    this.vals = (c.edit ? c.start : c.values)?.slice() ?? z();
    this.mod = undefined;
    const load = c.module ? MODULES[c.module] : undefined, gen = ++this.gen;
    if (c.module && !load) throw new Error(`Unknown chart-builder module ${c.module}`);
    if (load) this.ready = load().then((m) => {
      if (gen !== this.gen) return; // a newer config arrived while this one was loading
      this.mod = m.mount(this, c);
      this.render();
    });
    this.render();
  }

  get state() {
    const c = this.cfg;
    const pie = c.chart === 'pie' && c.sectors && c.edit;
    return {
      tally: this.tal.slice(),
      typed: this.typed.slice(),
      values: pie ? paintedValues(this.paint, this.cats.length, this.key) : this.vals.slice(),
      unit: c.chart === 'pictogram' || c.chart === 'pie' ? this.key : this.step > 1 && !c.level ? this.step : 1,
      pool: this.pool,
      left: this.used.filter((u) => u < 0).length,
      cat: this.picked,
      chart: this.kind,
      ...this.mod?.state(),
    };
  }

  private get key() { return this.cfg.key ?? 1; }
  private get part() { return this.cfg.part ?? (this.key % 2 ? 1 : 2); }
  private get lo() { return this.cfg.min ?? 0; }
  private get hi() {
    const c = this.cfg;
    if (c.max) return c.max;
    const top = Math.max(1, ...this.vals, ...(c.values ?? []));
    return c.chart === 'pictogram' ? Math.max(top, this.key * 6) : Math.ceil(top / this.step0(top)) * this.step0(top);
  }
  private step0(top: number) { return this.cfg.step ?? niceStep(top - this.lo, 10); }
  private get step() { return this.cfg.step ?? niceStep(this.hi - this.lo, 10); }
  /** Smallest change of a bar, point or pictogram row. */
  private get inc() { return this.cfg.chart === 'pictogram' ? this.key / this.part : this.cfg.snap ?? 1; }

  L(k: string, fb = '') {
    return this.dataset[k.replace(/-(\w)/g, (_, ch: string) => ch.toUpperCase())] ?? fb;
  }
  private name(i: number) { return this.L(`cat-${this.cats[i].key}`, this.cats[i].key); }
  num(n: number) {
    return digitsOf(String(+n.toFixed(2)).replace('.', this.dataset.decimal ?? '.'), { digits: this.dataset.digits ?? '0123456789', decimal: '.' });
  }
  private fill(t: string, i: number, n?: number) {
    return t.replace('{c}', this.name(i)).replace('{n}', n === undefined ? '' : this.num(n));
  }
  /** Picture of category i; `sym` = the pictogram symbol (config `icon` if set, so every row uses the same picture). */
  private ico(i: number, x = 0, y = 0, s = 24, frac = 1, vertical = false, sym = false) {
    const c = this.cats[i];
    const ic = (sym && this.cfg.icon) || c.icon!;
    const vb = vertical ? `0 ${24 * (1 - frac)} 24 ${24 * frac}` : `0 0 ${24 * frac} 24`;
    const [w, h] = vertical ? [s, s * frac] : [s * frac, s];
    return `<svg x="${x}" y="${vertical ? y + s - h : y}" width="${w}" height="${h}" viewBox="${vb}" class="ico c-${c.color}">${ICONS[ic] ?? ICONS.square}</svg>`;
  }

  connectedCallback() {
    if (this.built) return this.ro?.observe(this);
    this.built = true;
    this.addEventListener('click', (e) => this.click(e));
    this.addEventListener('pointerdown', (e) => this.down(e));
    this.addEventListener('pointermove', (e) => (this.drag >= 0 ? this.setFrom(this.drag, e) : this.mod?.move?.(e)));
    const up = () => ((this.drag = -1), this.mod?.up?.());
    this.addEventListener('pointerup', up);
    this.addEventListener('pointercancel', up);
    this.addEventListener('keydown', (e) => this.key_(e));
    this.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.dataset.count) return this.mod?.input?.(t) && this.changed();
      const v = asciiDigits(t.value.trim());
      this.typed[+t.dataset.count] = /^\d+$/.test(v) ? +v : null;
      this.changed();
    });
    this.ro = new ResizeObserver(() => {
      const w = Math.round(this.clientWidth);
      if (w > 0 && Math.abs(w - this.width) > 1) {
        this.width = w;
        this.render();
      }
    });
    this.ro.observe(this);
  }

  disconnectedCallback() { this.ro?.disconnect(); }

  changed(render = false) {
    if (render) this.render();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  // ---------- interaction ----------

  private click(e: Event) {
    const t = (e.target as Element).closest<HTMLElement>('[data-a]');
    if (!t) return;
    const i = Number(t.dataset.i);
    const c = this.cfg;
    this.say = '';
    switch (t.dataset.a) {
      case 'card': {
        if (this.used[i] >= 0) this.unplace(i);
        else if (c.collect === 'auto') this.place(i, this.cats.findIndex((k) => k.key === c.data![i]));
        else this.sel = this.sel === i ? -1 : i;
        break;
      }
      case 'add':
        if (c.data?.length && this.sel < 0) {
          this.say = this.L('label-pick-card', '');
          return this.render();
        }
        if (this.sel >= 0) this.place(this.sel, i);
        else (this.tal[i]++, this.marks[i].push(-1));
        break;
      case 'del': {
        if (!this.tal[i]) return;
        const card = this.marks[i].at(-1)!;
        if (card >= 0) this.unplace(card);
        else (this.tal[i]--, this.marks[i].pop());
        break;
      }
      case 'less':
      case 'more':
        return this.setVal(i, this.vals[i] + (t.dataset.a === 'more' ? this.inc : -this.inc));
      case 'brush':
        this.brush = i;
        return this.render();
      case 'sector':
        if (c.edit) this.paint[i] = this.paint[i] === this.brush ? -1 : this.brush;
        else if (c.pick && this.paint[i] >= 0) this.picked = this.cats[this.paint[i]].key;
        break;
      case 'pick':
        if (!c.pick) return;
        this.picked = this.cats[i].key;
        break;
      case 'kind':
        this.kind = c.choose![i];
        break;
      default:
        if (!this.mod?.act?.(t)) return;
    }
    this.changed(true);
  }

  private place(card: number, row: number) {
    this.used[card] = row;
    this.tal[row]++;
    this.marks[row].push(card);
    this.sel = -1;
  }

  private unplace(card: number) {
    const row = this.used[card];
    const k = this.marks[row].lastIndexOf(card);
    this.marks[row].splice(k, 1);
    this.tal[row]--;
    this.used[card] = -1;
  }

  private setVal(i: number, v: number) {
    v = snapTo(v, this.inc, this.cfg.chart === 'line' ? this.lo : 0, this.hi);
    if (this.cfg.level) ({ values: this.vals, pool: this.pool } = level(this.vals, this.pool, i, v));
    else if (this.vals[i] !== v) this.vals[i] = v;
    else return;
    this.changed(true);
  }

  private down(e: PointerEvent) {
    const t = (e.target as Element).closest<SVGElement | HTMLElement>('[data-s]');
    if (!t) {
      if (this.mod?.down?.(e)) (e.preventDefault(), this.setPointerCapture?.(e.pointerId));
      return;
    }
    e.preventDefault();
    this.drag = Number(t.dataset.s);
    this.setPointerCapture?.(e.pointerId); // the host survives re-renders while dragging
    this.setFrom(this.drag, e);
  }

  /** Value from a pointer: pictogram rows grow to the right, everything else grows up. */
  private setFrom(i: number, e: PointerEvent) {
    const el = this.querySelector(`[data-s="${i}"] .hit`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (this.rows) {
      const n = Math.ceil(((e.clientX - r.left) / r.height) * this.part) / this.part; // symbols are square, as wide as the row is high
      this.setVal(i, n * this.key);
    } else this.setVal(i, lerp(e.clientY, r.bottom, r.top, this.cfg.chart === 'line' ? this.lo : 0, this.hi));
  }

  private key_(e: KeyboardEvent) {
    const a = e.target as HTMLElement;
    if (this.mod?.key?.(e)) return e.preventDefault();
    // SVG sectors and columns act as buttons
    if ((e.key === 'Enter' || e.key === ' ') && a.dataset?.a && a.tagName !== 'BUTTON') {
      e.preventDefault();
      return this.click(e);
    }
    const t = a.closest<HTMLElement>('[data-s]');
    if (!t) return;
    const i = Number(t.dataset.s);
    const v = this.vals[i];
    const k: Record<string, number> = {
      ArrowUp: v + this.inc, ArrowRight: v + this.inc, ArrowDown: v - this.inc, ArrowLeft: v - this.inc,
      PageUp: v + this.step, PageDown: v - this.step, Home: 0, End: this.hi,
    };
    if (e.key in k) {
      e.preventDefault();
      this.setVal(i, k[e.key]);
    }
  }

  // ---------- drawing ----------

  private get rows() { return this.cfg.chart === 'pictogram' && this.cfg.orient !== 'columns'; }

  private render() {
    const c = this.cfg;
    const d = (document.activeElement as HTMLElement | null)?.dataset ?? {};
    const had = this.contains(document.activeElement);
    const f = d.k ? `[data-k="${d.k}"]` : d.s ? `[data-s="${d.s}"]` : d.count ? `[data-count="${d.count}"]` : d.a ? `[data-a="${d.a}"][data-i="${d.i}"]` : '';
    let h = '';
    if (c.instruction)
      h += `<p class="kg-cb-hint"><span class="kg-cb-i" aria-hidden="true">${this.hintIcon(c.instruction)}</span>${esc(this.L(`instruction-${c.instruction}`))}</p>`;
    if (c.data?.length) h += this.cards();
    if (c.table || this.rows) h += this.table();
    if (c.chart === 'pie') h += this.pie();
    else if (c.chart && !this.rows) h += this.columns();
    if (c.chart === 'pictogram') h += this.keyLine();
    if (this.mod) h += this.mod.html();
    if (c.level) h += `<p class="kg-cb-pool" role="status">${esc(this.fill(this.L('label-pool', '{n}'), 0, this.pool))}</p>`;
    if (c.choose) h += this.choose();
    h += `<p class="kg-cb-say" role="status">${esc(this.say)}</p>`;
    this.innerHTML = h;
    if (f && had) this.querySelector<HTMLElement>(f)?.focus();
  }

  /** A picture of the action for children who cannot read the prompt yet. */
  private hintIcon(k: string) {
    if (k === 'sort' || k === 'tally' || k === 'count') return this.tallySvg(k === 'count' ? 7 : 5);
    const kind: Kind = k === 'paint' ? 'pie' : k === 'build' || k === 'read' ? (this.cfg.chart ?? 'bar') : 'bar';
    return svg(40, 32, KINDS[kind], 'mini');
  }

  private cards() {
    const c = this.cfg;
    const b = c.data!.map((k, j) => {
      const i = this.cats.findIndex((x) => x.key === k);
      const u = this.used[j] >= 0;
      return `<button type="button" class="kg-cb-card${u ? ' used' : ''}" data-a="card" data-i="${j}" aria-pressed="${this.sel === j}"` +
        ` aria-label="${esc(this.fill(this.L(u ? 'label-used' : 'label-card', '{c}'), i, j + 1))}">${svg(30, 30, this.ico(i, 3, 3, 24), '', ' aria-hidden="true"')}</button>`;
    });
    return `<div class="kg-cb-cards" role="group" aria-label="${esc(this.L('label-cards'))}">${b.join('')}</div>`;
  }

  private tallySvg(n: number) {
    const { fives, rest } = tallyGroups(n);
    let p = '';
    let x = 3;
    for (let g = 0; g < fives; g++, x += 32) {
      for (let k = 0; k < 4; k++) p += `M${x + k * 6} 3v20`;
      p += `M${x - 3} 19L${x + 21} 7`;
    }
    for (let k = 0; k < rest; k++) p += `M${x + k * 6} 3v20`;
    return svg(Math.max(8, x + rest * 6), 26, p ? `<path d="${p}"/>` : '', 'kg-cb-tally', ' aria-hidden="true"');
  }

  private table() {
    const c = this.cfg;
    const t = c.table ?? {};
    const tally = !!c.table && (t.tally ?? 'show') !== 'hide';
    const count = !!c.table && (t.count ?? 'hide') !== 'hide';
    const pict = this.rows;
    const th = (s: string) => `<th scope="col">${esc(s)}</th>`;
    let h = `<table class="kg-cb-table"><thead><tr>${th(this.L(`head-${t.head ?? 'cat'}`))}` +
      (tally ? th(this.L('col-tally')) : '') + (count ? th(this.L('col-count')) : '') + (pict ? th(this.L('col-picture')) : '') + '</tr></thead><tbody>';
    this.cats.forEach((_, i) => {
      const nm = `${svg(22, 22, this.ico(i, 0, 0, 22), '', ' aria-hidden="true"')}<span>${esc(this.name(i))}</span>`;
      h += '<tr><th scope="row">' + (c.pick ? `<button type="button" class="kg-cb-pick" data-a="pick" data-i="${i}" aria-pressed="${this.picked === this.cats[i].key}">${nm}</button>` : nm) + '</th>';
      if (tally) {
        const n = this.tal[i];
        const lab = `${this.name(i)}: ${this.num(n)}`;
        h += t.tally === 'edit'
          ? `<td class="kg-cb-tc"><button type="button" class="kg-cb-add" data-a="add" data-i="${i}" aria-label="${esc(this.fill(this.L('label-add', '+ {c}'), i))}">${this.tallySvg(n)}</button>` +
            `<button type="button" class="kg-cb-del secondary" data-a="del" data-i="${i}" aria-label="${esc(this.fill(this.L('label-remove', '− {c}'), i))}"${n ? '' : ' disabled'}>−</button><span class="vh">${esc(lab)}</span></td>`
          : `<td class="kg-cb-tc" role="img" aria-label="${esc(this.fill(this.L('label-marks', '{c}: {n}'), i, n))}">${this.tallySvg(n)}</td>`;
      }
      if (count) {
        const v = c.values?.[i] ?? this.tal[i];
        h += t.count === 'edit'
          ? `<td><input class="kg-cb-num" inputmode="numeric" autocomplete="off" data-count="${i}" value="${this.typed[i] == null ? '' : this.num(this.typed[i]!)}" aria-label="${esc(this.fill(this.L('label-count', '{c}'), i))}"></td>`
          : `<td class="kg-cb-n">${this.num(v)}</td>`;
      }
      if (pict) h += `<td class="kg-cb-pc">${this.strip(i)}</td>`;
      h += '</tr>';
    });
    if (t.total) {
      const tot = count && t.count !== 'edit' ? sum(this.cats.map((_, i) => c.values?.[i] ?? this.tal[i])) : sum(this.tal);
      h += `<tr class="kg-cb-total"><th scope="row">${esc(this.L('label-total'))}</th>${tally ? `<td>${count ? '' : this.num(tot)}</td>` : ''}${count ? `<td class="kg-cb-n">${t.count === 'edit' ? '' : this.num(tot)}</td>` : ''}${pict ? '<td></td>' : ''}</tr>`;
    }
    return h + '</tbody></table>';
  }

  /** One pictogram row: symbols left → right, a partial symbol cut from its right side. */
  private strip(i: number) {
    const c = this.cfg;
    const S = 28;
    const cap = Math.ceil(this.hi / this.key);
    const sy = symbols(this.vals[i], this.key, this.part);
    const body = sy.map((fr, k) => this.ico(i, k * S + 2, 2, S - 4, fr, false, true)).join('');
    const w = cap * S;
    const said = this.fill(this.L('label-symbols', '{c}: {n}'), i, sum(sy));
    const pic = svg(w, S, `<rect class="hit" width="${w}" height="${S}"/>${body}`, 'kg-cb-strip');
    if (!c.edit) return `<div class="kg-cb-row" dir="ltr" role="img" aria-label="${esc(said)}">${pic}</div>`;
    return `<div class="kg-cb-row" dir="ltr"><div data-s="${i}" tabindex="0" role="slider" aria-label="${esc(this.name(i))}" aria-valuemin="0" aria-valuemax="${this.hi}" aria-valuenow="${this.vals[i]}" aria-valuetext="${esc(said)}">${pic}</div>` +
      `<span class="kg-cb-pm"><button type="button" class="secondary" data-a="less" data-i="${i}" aria-label="${esc(this.fill(this.L('label-less', '− {c}'), i))}">−</button>` +
      `<button type="button" class="secondary" data-a="more" data-i="${i}" aria-label="${esc(this.fill(this.L('label-more', '+ {c}'), i))}">+</button></span></div>`;
  }

  private keyLine() {
    const k = `${svg(22, 22, this.ico(0, 0, 0, 22, 1, false, true), '', ' aria-hidden="true"')} = ${this.num(this.key)}`;
    const u = this.cfg.unit ? ' ' + esc(this.L(`unit-${this.cfg.unit}`)) : '';
    return `<p class="kg-cb-key"><b>${esc(this.L('label-key'))}</b> <bdi dir="ltr">${k}</bdi>${u}</p>`;
  }

  /** Bar chart, line graph or pictogram in columns: value axis on the left, going up. */
  private columns() {
    const c = this.cfg;
    const n = this.cats.length;
    const pict = c.chart === 'pictogram';
    const lo = c.chart === 'line' ? this.lo : 0;
    const hi = this.hi;
    const W = Math.max(240, this.width);
    const ML = pict ? 8 : 38;
    const MT = c.axes?.[1] ? 26 : 12;
    const bw = (W - ML - 14) / n;
    const S = Math.min(30, bw - 4);
    const PH = pict ? Math.ceil(hi / this.key) * S : 190;
    const y0 = MT + PH;
    const lines = this.cats.map((_, i) => twoLines(this.name(i), bw < 52 ? 5 : 8));
    const H = y0 + 10 + 16 * Math.max(...lines.map((l) => l.length)) + (c.axes?.[0] ? 18 : 0);
    const y = (v: number) => lerp(v, lo, hi, y0, MT);
    const cx = (i: number) => ML + bw * (i + 0.5);
    let g = '';
    if (!pict) {
      for (const v of ticks(lo, hi, this.step))
        g += `<path class="grid" d="M${ML} ${y(v)}H${W - 6}"/><text class="lab" x="${ML - 6}" y="${y(v) + 5}" text-anchor="end">${this.num(v)}</text>`;
      if (lo > 0) g += `<path class="brk" d="M${ML - 5} ${y0 - 3}l5-4 5 4"/>`; // axis does not start at 0
      if (c.axes?.[1]) g += `<text class="lab ttl" x="${ML - 30}" y="14">${esc(this.L(`axis-${c.axes[1]}`))}</text>`;
    }
    g += `<path class="axis" d="M${ML} ${MT - 6}V${y0}H${W - 4}M${ML - 4} ${MT}l4-7 4 7M${W - 10} ${y0 - 4}l7 4-7 4"/>`;
    const pts: string[] = [];
    this.cats.forEach((k, i) => {
      const v = this.vals[i];
      const x = cx(i);
      let m = '';
      if (pict) m = symbols(v, this.key, this.part).map((fr, j) => this.ico(i, x - S / 2 + 2, y0 - (j + 1) * S + 2, S - 4, fr, true, true)).join('');
      else if (c.chart === 'bar') m = `<rect class="bar c-${k.color}" x="${x - Math.min(36, bw * 0.6) / 2}" y="${y(Math.max(v, 0))}" width="${Math.min(36, bw * 0.6)}" height="${y0 - y(Math.max(v, 0))}"/>`;
      else {
        pts.push(`${x} ${y(v)}`);
        m = `<circle class="pt" cx="${x}" cy="${y(v)}" r="${c.edit ? 9 : 6}"/>`;
      }
      const lab = lines[i].map((s, j) => `<text class="lab${bw < 52 ? ' sm' : ''}" x="${x}" y="${y0 + 22 + 16 * j}" text-anchor="middle">${esc(s)}</text>`).join('');
      const said = `${this.name(i)}: ${pict ? this.fill(this.L('label-symbols', '{n}'), i, sum(symbols(v, this.key, this.part))) : this.num(v)}`;
      const hit = `<rect class="hit" x="${x - bw / 2}" y="${MT}" width="${bw}" height="${PH}"/>`;
      const sel = this.picked === k.key ? ' picked' : '';
      if (c.edit)
        g += `<g class="col${sel}" data-s="${i}" tabindex="0" role="slider" aria-label="${esc(this.name(i))}" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${v}" aria-valuetext="${esc(said)}">${hit}${m}</g>`;
      else if (c.pick)
        g += `<g class="col${sel}" data-a="pick" data-i="${i}" tabindex="0" role="button" aria-pressed="${!!sel}" aria-label="${esc(said)}">${hit}${m}</g>`;
      else g += `<g class="col" role="img" aria-label="${esc(said)}">${hit}${m}</g>`;
      g += lab;
    });
    if (pts.length) g = g.replace('<g class="col', `<path class="ln" d="M${pts.join('L')}"/><g class="col`);
    if (c.meanLine) g += `<path class="mean" d="M${ML} ${y(mean(c.values ?? this.vals))}H${W - 6}"/>`;
    if (c.axes?.[0]) g += `<text class="lab ttl" x="${W - 4}" y="${H - 4}" text-anchor="end">${esc(this.L(`axis-${c.axes[0]}`))}</text>`;
    return `<div class="kg-cb-chart" dir="ltr">${svg(W, H, g, 'kg-cb-svg', ` role="group" aria-label="${esc(this.L('label-chart'))}"`)}</div>`;
  }

  /** Pie chart from 12 o'clock, clockwise: equal sectors to paint, or slices for the values. */
  private pie() {
    const c = this.cfg;
    const W = Math.max(240, this.width);
    const R = Math.min(130, W / 2 - 12);
    const C = R + 6;
    let g = '';
    const sec = (d: string, cat: number, j: number, act: boolean) => {
      const nm = cat >= 0 ? this.name(cat) : this.L('label-empty', '-');
      const cls = `sec${cat >= 0 ? ` c-${this.cats[cat].color}` : ''}${cat >= 0 && this.picked === this.cats[cat].key ? ' picked' : ''}`;
      return act
        ? `<path class="${cls}" d="${d}" data-a="sector" data-i="${j}" tabindex="0" role="button" aria-label="${esc(`${this.num(j + 1)}: ${nm}`)}"/>`
        : `<path class="${cls}" d="${d}"/>`;
    };
    if (c.sectors) {
      const a = 360 / c.sectors;
      this.paint.forEach((p, j) => (g += sec(sectorPath(C, C, R, j * a, (j + 1) * a), p, j, !!c.edit || (!!c.pick && p >= 0))));
    } else for (const s of slices(this.vals)) g += sec(sectorPath(C, C, R, s.a0, s.a1), s.i, s.i, false);
    const legend = this.cats.map((k, i) => {
      const sw = `<span class="sw c-${k.color}" aria-hidden="true"></span>${esc(this.name(i))}`;
      if (c.edit) return `<button type="button" role="radio" class="kg-cb-brush" data-a="brush" data-i="${i}" aria-checked="${this.brush === i}">${sw}</button>`;
      if (c.pick) return `<button type="button" class="kg-cb-pick" data-a="pick" data-i="${i}" aria-pressed="${this.picked === k.key}">${sw}</button>`;
      return `<span>${sw}</span>`;
    });
    const said = this.cats.map((_, i) => `${this.name(i)}: ${this.num(this.state.values[i])}`).join(document.documentElement.dir === 'rtl' ? '، ' : ', ');
    return `<div class="kg-cb-chart kg-cb-pie" dir="ltr">${svg(2 * C, 2 * C, g, 'kg-cb-svg', ` role="${c.edit || c.pick ? 'group' : 'img'}" aria-label="${esc(this.L('label-chart') + (c.edit ? '' : ' — ' + said))}"`)}</div>` +
      `<div class="kg-cb-legend"${c.edit ? ` role="radiogroup" aria-label="${esc(this.L('label-brush'))}"` : ''}>${legend.join('')}</div>`;
  }

  private choose() {
    const b = this.cfg.choose!.map((k, i) =>
      `<button type="button" role="radio" class="kg-cb-kind" data-a="kind" data-i="${i}" aria-checked="${this.kind === k}">${svg(40, 32, KINDS[k], 'mini', ' aria-hidden="true"')}<span>${esc(this.L(`chart-${k}`, k))}</span></button>`);
    return `<div class="kg-cb-kinds" role="radiogroup" aria-label="${esc(this.L('label-choose'))}">${b.join('')}</div>`;
  }
}

customElements.define('kg-chart-builder', ChartBuilder);
