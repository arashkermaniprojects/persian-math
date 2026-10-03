// <kg-coord-plane>: a coordinate plane. The learner plots and drags points (with a typed table of values), drags the
// two handles of a line or sets its m and c on sliders (with the step triangle, the intercept and the live equation),
// and plots y = f(x) with parameter sliders and a trace cursor. Geometry and the `coord` check live in
// engines/lib/coord-plane-*.ts. Contract: docs/STUDIOS.md. The plane is LTR in every locale (x to the right, y up),
// as on both countries' coordinate grids; only the table follows the page direction (docs/NOTATION.md "Charts").
// Extension point: on-demand modules (coord-plane/<name>.ts, e.g. `vectors`) plug in through MODULES / PlaneModule.
import { fracHTML } from '../lib/display';
import {
  clipLine, compile, equationParts, gridValues, labelEvery, lineThrough, parseTyped, sample, samePt, snapTo, step, tidy, toFrac,
  valueAt, type Line, type P,
} from './lib/coord-plane-math';
import type { CoordState } from './lib/coord-plane-check';
import type { Tok } from './lib/pattern-machine-expr';

type Range3 = [number, number, number];
/** A reference line: y = m x + c, the vertical x = k, or through two points. */
export interface GivenLine { m?: number; c?: number; x?: number; through?: [P, P]; tone?: number; dash?: boolean }
export interface GivenGraph {
  /** y = f(x), an expression in x and parameter letters ("a*x^2 + k"). */
  f: string;
  /** Sliders for the parameters: { a: [min, max, step, start] }. A graph with sliders is the learner's. */
  params?: Record<string, [number, number, number, number?]>;
  tone?: number;
  dash?: boolean;
}

export interface CoordPlaneConfig {
  /** Extent in units (default −5..5 both ways). */
  x?: [number, number];
  y?: [number, number];
  /** Units per grid square: one number or [x, y] (e.g. [1, 2]: the y-axis counts in twos). Default 1. */
  scale?: number | [number, number];
  /** Snap step in units (default: one square). */
  step?: number | [number, number];
  /** points: plot/drag points · line: drag two handles or set m, c · graph: y = f(x) with sliders · view. */
  mode?: 'points' | 'line' | 'graph' | 'view';
  /** Fixed points, lettered with `labels`. */
  given?: P[];
  /** Letter the given points, then the learner's (engine label `letters`). */
  labels?: boolean;
  /** points mode: start points the learner may move, and the most they may place (default 10). */
  points?: P[];
  max?: number;
  /** A table of values: the learner types y for each x (page direction). */
  table?: { x: number[] };
  /** line mode: two draggable `handles`, or `sliders` for m and c ([min, max, step]) starting at `m`, `c`. */
  line?: { handles?: [P, P]; m?: number; c?: number; sliders?: { m?: Range3; c?: Range3 } };
  lines?: GivenLine[];
  graphs?: GivenGraph[];
  /** graph mode: a cursor on the learner's graph that reads (x, y). */
  trace?: boolean;
  /** gradient (step triangle: run and rise), intercept (ring where the line meets the y-axis), equation, coords. */
  show?: string[];
  /** Icon hint + engine label `instruction-<key>`: points, drag, slide, trace. */
  instruction?: string;
  /** An on-demand module (see MODULES), e.g. `vectors` (its options sit under their own key, e.g. `vectors: {…}`). */
  module?: string;
  vectors?: unknown;
}

/** What an on-demand module (coord-plane/<name>.ts) plugs into the plane. */
export interface PlaneModule {
  /** Extra SVG, drawn over the grid and lines and under the learner's points. */
  draw(out: string[]): void;
  /** A pointer went down at plane position q; return true if the module took it. Then move/up follow. */
  down?(q: P, e: PointerEvent): boolean;
  move?(q: P): void;
  up?(): void;
  /** A key on the plane with the keyboard cursor at `cursor`; return true if handled. */
  key?(e: KeyboardEvent, cursor: P): boolean;
  /** Extra toolbar buttons (HTML). */
  tools?(): string;
  /** Merged into state.plane (e.g. { vectors: [...] }). */
  state(): Record<string, unknown>;
  /** Readouts (HTML) added under the plane, and what the live region says (empty = the plane's own text). */
  facts?(): string[];
  live?(cursor: P): string;
}
type ModuleLoader = () => Promise<{ mount(plane: CoordPlane, cfg: CoordPlaneConfig): PlaneModule }>;
/** On-demand modules, loaded only when a mission's setup names them (each is its own chunk). */
export const MODULES: Record<string, ModuleLoader> = {
  vectors: () => import('./coord-plane/vectors'),
};

const NS = 'http://www.w3.org/2000/svg';
const HIT = 23; // 46px touch targets (≥ 44 after rounding)
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const pair = (v: number | [number, number] | undefined, d: number): P => (Array.isArray(v) ? v : [v ?? d, v ?? d]);

export class CoordPlane extends HTMLElement {
  cfg: CoordPlaneConfig = {};
  private pts: P[] = [];
  private handles: P[] = [];
  private vals: Record<string, number> = {};
  private cells: (number | null)[] = [];
  private active = 0;
  private cursor: P = [0, 0];
  private traceX: number | null = null;
  private drag: { kind: 'p' | 'h' | 'm' | 't'; i: number; moved: boolean; fresh: boolean } | null = null;
  private toks: Tok[][] = [];
  private width = 340;
  private svg = document.createElementNS(NS, 'svg');
  private parts?: Record<'hint' | 'main' | 'sliders' | 'table' | 'facts' | 'tools' | 'live', HTMLElement>;
  private ro?: ResizeObserver;
  private wired = false;
  mod?: PlaneModule;
  ready: Promise<void> = Promise.resolve();

  set config(c: CoordPlaneConfig) {
    this.cfg = c;
    this.pts = (c.points ?? []).map((p) => [...p] as P);
    this.handles = (c.line?.handles ?? []).map((p) => [...p] as P);
    this.vals = {};
    if (c.line?.sliders) Object.assign(this.vals, { m: c.line.m ?? 1, c: c.line.c ?? 0 });
    (c.graphs ?? []).forEach((g) => Object.entries(g.params ?? {}).forEach(([k, r]) => (this.vals[k] = r[3] ?? r[0])));
    this.toks = (c.graphs ?? []).map((g) => compile(g.f));
    this.cells = (c.table?.x ?? []).map(() => null);
    this.active = 0;
    this.traceX = c.trace ? 0 : null;
    this.cursor = [snapTo(0, this.st[0], this.x0, this.x1), snapTo(0, this.st[1], this.y0, this.y1)];
    this.mod = undefined;
    const load = c.module ? MODULES[c.module] : undefined;
    if (c.module && !load) throw new Error(`Unknown coord-plane module ${c.module}`);
    // a stale load (the mission changed while it was loading) is dropped; build() adds the module's tools
    if (load) this.ready = load().then((m) => { if (this.cfg === c) { this.mod = m.mount(this, c); this.build(); } });
    this.build();
  }

  get state(): { plane: CoordState & Record<string, unknown> } {
    const c = this.cfg, line = this.line();
    return {
      plane: {
        points: this.pts.map((p) => [...p] as P),
        lines: line ? [{ ...line, ...(this.handles.length === 2 ? { through: this.handles.map((p) => [...p] as P) } : {}) }] : [],
        graphs: (c.graphs ?? []).filter((g) => g.params).map((g) => ({ f: g.f, params: Object.fromEntries(Object.keys(g.params!).map((k) => [k, this.vals[k]])) })),
        table: (c.table?.x ?? []).map((x, i) => ({ x, y: this.cells[i] })),
        scale: this.sc,
        ...this.mod?.state(),
      },
    };
  }

  // ---------- geometry ----------
  get x0() { return this.cfg.x?.[0] ?? -5; }
  get x1() { return this.cfg.x?.[1] ?? 5; }
  get y0() { return this.cfg.y?.[0] ?? -5; }
  get y1() { return this.cfg.y?.[1] ?? 5; }
  get sc() { return pair(this.cfg.scale, 1); }
  get st() { const s = this.sc; return pair(this.cfg.step, NaN).map((v, i) => (Number.isNaN(v) ? s[i] : v)) as P; }
  private get mode() { return this.cfg.mode ?? 'view'; }
  private M = 30;
  /** Pixels per grid square. */
  private get U() {
    const n = (this.x1 - this.x0) / this.sc[0];
    return Math.max(16, Math.min(56, (this.width - 2 * this.M) / n));
  }
  sx = (x: number) => +(this.M + ((x - this.x0) / this.sc[0]) * this.U).toFixed(1);
  sy = (y: number) => +(this.M + ((this.y1 - y) / this.sc[1]) * this.U).toFixed(1);
  /** The snapped plane point nearest q. */
  snap = (q: P): P => [snapTo(q[0], this.st[0], this.x0, this.x1), snapTo(q[1], this.st[1], this.y0, this.y1)];

  /** Locale digits, minus sign and decimal mark. */
  d(n: number | string) {
    const dg = this.dataset.digits ?? '0123456789';
    return String(typeof n === 'number' ? tidy(n) : n).replace(/-/g, '−').replace(/[0-9]/g, (x) => dg[+x]).replace('.', this.dataset.decimal ?? '.');
  }
  /** A number as HTML: whole numbers in locale digits, others as a stacked fraction (never a/b inline). */
  numHTML(v: number) {
    const [n, d] = toFrac(v);
    const f = { digits: this.dataset.digits ?? '0123456789', decimal: this.dataset.decimal ?? '.' };
    return d === 1 || d > 12 ? this.d(v) : (n < 0 ? '−' : '') + fracHTML(Math.abs(n), d, f);
  }
  /** Engine label (studio JSON "engine"), with {name} placeholders. */
  lab(k: string, fb = '', vars: Record<string, string> = {}) {
    return (this.dataset[k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] ?? fb).replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? '');
  }
  /** Engine label as HTML, each {name} value isolated left to right (so −۴ keeps its minus on the left in RTL text). */
  private labHTML(k: string, fb: string, vars: Record<string, string>) {
    return esc(this.lab(k, fb, Object.fromEntries(Object.keys(vars).map((v) => [v, `\u0001${v}\u0002`])))).replace(/\u0001(\w+)\u0002/g, (_, v: string) => `<bdi dir="ltr">${esc(vars[v])}</bdi>`);
  }
  private letter(i: number) {
    const l = (this.dataset.letters ?? 'A B C D E F G H I J K L').split(/[\s,،]+/);
    return l[i % l.length];
  }

  /** The learner's line: from the handles, or y = m x + c from the sliders. */
  private line(): Line | null {
    if (this.handles.length === 2) return lineThrough(this.handles[0], this.handles[1]);
    return this.cfg.line?.sliders ? { m: this.vals.m, c: this.vals.c } : null;
  }

  private toPlane(e: PointerEvent): P {
    const r = this.svg.getBoundingClientRect(), vb = this.svg.viewBox.baseVal;
    const px = ((e.clientX - r.left) * vb.width) / (r.width || 1), py = ((e.clientY - r.top) * vb.height) / (r.height || 1);
    return [this.x0 + ((px - this.M) / this.U) * this.sc[0], this.y1 - ((py - this.M) / this.U) * this.sc[1]];
  }

  changed() {
    this.render();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  // ---------- input ----------
  connectedCallback() {
    this.mkParts();
    if (this.wired) return this.ro?.observe(this.parts!.main);
    this.wired = true;
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.dragTo(e));
    const up = () => {
      const d = this.drag;
      this.drag = null;
      if (d?.kind === 'm') this.mod?.up?.();
      if (d?.kind === 'p' && !d.moved && !d.fresh) { this.pts.splice(d.i, 1); this.active = this.pts.length - 1; this.changed(); }
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', () => (this.drag = null));
    const later = () => setTimeout(() => this.render());
    svg.addEventListener('focus', later);
    svg.addEventListener('blur', later);
    this.addEventListener('keydown', (e) => this.key(e));
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-act]');
      if (!b) return;
      const a = b.dataset.act, k = b.dataset.k!;
      if (a === 'clear') { this.pts = []; this.changed(); }
      if (a === 'dec' || a === 'inc') this.setVal(k, this.vals[k] + (a === 'inc' ? 1 : -1) * this.range(k)[2]);
    });
    this.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.type === 'range') this.setVal(t.dataset.k!, Number(t.value));
      else if (t.dataset.cell) {
        this.cells[+t.dataset.cell] = parseTyped(t.value, this.dataset.decimal ?? '.');
        this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
      }
    });
    this.ro = new ResizeObserver(() => {
      const w = Math.round(this.parts!.main.clientWidth);
      if (w > 0 && Math.abs(w - this.width) > 1) { this.width = w; this.render(); }
    });
    this.ro.observe(this.parts!.main);
    // draw at the real width straight away, so the plane is never scaled down (44px targets stay 44px)
    const w = Math.round(this.parts!.main.clientWidth);
    if (w > 0 && w !== this.width) { this.width = w; this.render(); }
  }

  disconnectedCallback() {
    this.ro?.disconnect();
  }

  private range(k: string): Range3 {
    const c = this.cfg, s = c.line?.sliders?.[k as 'm' | 'c'];
    if (s) return s;
    const g = (c.graphs ?? []).find((g) => g.params?.[k]);
    return (g?.params![k].slice(0, 3) ?? [-5, 5, 1]) as Range3;
  }

  private setVal(k: string, v: number) {
    const [lo, hi, st] = this.range(k);
    v = snapTo(v, st, lo, hi);
    if (v === this.vals[k]) return;
    this.vals[k] = v;
    const sl = this.parts!.sliders.querySelector<HTMLInputElement>(`input[data-k="${k}"]`)!;
    sl.value = String(v);
    sl.setAttribute('aria-valuetext', this.d(v));
    this.parts!.sliders.querySelector(`output[data-k="${k}"]`)!.innerHTML = this.numHTML(v);
    this.changed();
  }

  private down(e: PointerEvent) {
    const m = this.mode;
    if (m === 'view' && !this.mod) return;
    const q = this.toPlane(e), t = (e.target as Element).closest('[data-p],[data-h]');
    const grab = (kind: 'p' | 'h' | 'm' | 't', i: number, fresh = false) => {
      e.preventDefault();
      this.drag = { kind, i, moved: false, fresh };
      this.svg.setPointerCapture?.(e.pointerId);
    };
    if (this.mod?.down?.(q, e)) return grab('m', 0);
    if (t) {
      const kind = t.hasAttribute('data-p') ? 'p' : 'h', i = Number(t.getAttribute(`data-${kind}`));
      this.active = i;
      return grab(kind, i);
    }
    const p = this.snap(q);
    if (m === 'points') {
      if (this.pts.length < (this.cfg.max ?? 10)) {
        this.pts.push(p);
        this.active = this.pts.length - 1;
        this.changed();
        return grab('p', this.active, true);
      }
      this.moveTo('p', this.active, p);
      return grab('p', this.active, true);
    }
    if (m === 'line' && this.handles.length) {
      this.moveTo('h', this.active, p);
      return grab('h', this.active, true);
    }
    if (m === 'graph' && this.cfg.trace) {
      this.traceX = p[0];
      this.render();
      return grab('t', 0);
    }
  }

  private dragTo(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    const q = this.toPlane(e);
    if (d.kind === 'm') return this.mod?.move?.(q);
    if (d.kind === 't') { this.traceX = this.snap(q)[0]; return this.render(); }
    if (this.moveTo(d.kind, d.i, this.snap(q))) d.moved = true;
  }

  /** Move point or handle i to p; false if nothing changed (or the handles would meet). */
  private moveTo(kind: 'p' | 'h', i: number, p: P): boolean {
    const list = kind === 'p' ? this.pts : this.handles;
    if (!list[i] || samePt(list[i], p)) return false;
    if (kind === 'h' && samePt(this.handles[1 - i], p)) return false;
    list[i] = p;
    this.active = i;
    this.changed();
    return true;
  }

  private key(e: KeyboardEvent) {
    const t = e.target as Element, k = e.key, [a, b] = this.st;
    const dir: Record<string, P> = { ArrowRight: [a, 0], ArrowLeft: [-a, 0], ArrowUp: [0, b], ArrowDown: [0, -b] };
    const item = t.closest('[data-p],[data-h]');
    if (item) {
      const kind = item.hasAttribute('data-p') ? 'p' : 'h', i = Number(item.getAttribute(`data-${kind}`));
      const cur = (kind === 'p' ? this.pts : this.handles)[i];
      if (dir[k]) {
        e.preventDefault();
        // Right/Up always mean bigger: the plane runs left → right even on RTL pages.
        this.moveTo(kind, i, this.snap([cur[0] + dir[k][0], cur[1] + dir[k][1]]));
      } else if ((k === 'Delete' || k === 'Backspace') && kind === 'p') {
        e.preventDefault();
        this.pts.splice(i, 1);
        this.active = this.pts.length - 1;
        this.changed();
        this.svg.focus();
      }
      return;
    }
    // a module sees keys on its own items as well as on the plane
    if (this.mod?.key?.(e, this.cursor)) return;
    if (t !== this.svg) return;
    if (dir[k]) {
      e.preventDefault();
      if (this.traceX !== null) this.traceX = snapTo(this.traceX + dir[k][0], a, this.x0, this.x1);
      else this.cursor = this.snap([this.cursor[0] + dir[k][0], this.cursor[1] + dir[k][1]]);
      this.render();
    } else if ((k === 'Enter' || k === ' ') && this.mode === 'points') {
      e.preventDefault();
      const j = this.pts.findIndex((p) => samePt(p, this.cursor));
      if (j >= 0) this.pts.splice(j, 1);
      else if (this.pts.length < (this.cfg.max ?? 10)) this.pts.push([...this.cursor] as P);
      this.active = this.pts.length - 1;
      this.changed();
    } else if ((k === 'Backspace' || k === 'Delete') && this.pts.length) {
      e.preventDefault();
      this.pts.pop();
      this.active = this.pts.length - 1;
      this.changed();
    }
  }

  // ---------- drawing ----------
  private seg(a: P, b: P, cls: string) {
    return `<line class="${cls}" x1="${this.sx(a[0])}" y1="${this.sy(a[1])}" x2="${this.sx(b[0])}" y2="${this.sy(b[1])}"/>`;
  }
  private text(x: number, y: number, s: string, cls = 'kg-cp-num') {
    return `<text class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(s)}</text>`;
  }
  private lineSvg(l: Line | null, cls: string) {
    const s = l && clipLine(l, this.x0, this.x1, this.y0, this.y1);
    return s ? this.seg(s[0], s[1], cls) : '';
  }
  private coords(p: P) {
    const xy = { x: this.d(p[0]), y: this.d(p[1]) }, f = this.lab('label-coords', '({x}, {y})', xy), col = f.split('\n');
    // a format with a line break is written as a column in brackets, x on top (Iran's books; .vec in global.css)
    return col.length > 1 ? `<span class="vec" role="math" aria-label="${esc(`${xy.x}, ${xy.y}`)}">${col.map((l) => `<span>${esc(l)}</span>`).join('')}</span>` : `<bdi dir="ltr">${esc(f)}</bdi>`;
  }
  private equation(l: Line) {
    const e = equationParts(l), m = e.m;
    const mh = m === null ? '' : typeof m === 'string' ? this.d(m) : (m[0] < 0 ? '−' : '') + fracHTML(Math.abs(m[0]), m[1], { digits: this.dataset.digits ?? '0123456789', decimal: '.' });
    return `<bdi dir="ltr" class="kg-cp-eq">${esc(e.lhs)}${mh}${esc(this.d(e.rest))}</bdi>`;
  }

  private draw(): string[] {
    const c = this.cfg, show = c.show ?? [], U = this.U, [sx, sy] = this.sc, o: string[] = [];
    const W = ((this.x1 - this.x0) / sx) * U + 2 * this.M, H = ((this.y1 - this.y0) / sy) * U + 2 * this.M;
    o.push(`<rect class="kg-cp-bg" x="${this.M}" y="${this.M}" width="${(W - 2 * this.M).toFixed(1)}" height="${(H - 2 * this.M).toFixed(1)}"/>`);
    const xs = gridValues(this.x0, this.x1, sx), ys = gridValues(this.y0, this.y1, sy), k = labelEvery(U, 26);
    xs.forEach((x) => o.push(this.seg([x, this.y0], [x, this.y1], 'kg-cp-grid')));
    ys.forEach((y) => o.push(this.seg([this.x0, y], [this.x1, y], 'kg-cp-grid')));
    // axes through 0 (or along the edge), arrowheads on the positive ends; numbers in locale digits
    const ax = Math.min(Math.max(0, this.x0), this.x1), ay = Math.min(Math.max(0, this.y0), this.y1);
    const X = this.sx(ax), Y = this.sy(ay), R = this.sx(this.x1) + 12, T = this.sy(this.y1) - 12;
    o.push(`<path class="kg-cp-axis" d="M${this.sx(this.x0)} ${Y}H${R}M${X} ${this.sy(this.y0)}V${T}"/>`,
      `<path class="kg-cp-head" d="M${R + 6} ${Y}l-10 -5v10zM${X} ${T - 6}l-5 10h10z"/>`,
      this.text(R + 4, Y - 10, 'x', 'kg-cp-num kg-cp-xy'), this.text(X + 13, T + 4, 'y', 'kg-cp-num kg-cp-xy'));
    const on = (v: number, s: number) => Math.round(v / s) % k === 0;
    xs.forEach((x) => on(x, sx) && o.push(this.text(this.sx(x) - (x === ax ? 8 : 0), Y + 18, this.d(x))));
    ys.forEach((y) => on(y, sy) && y !== ay && o.push(this.text(X - 12, this.sy(y) + 5, this.d(y), 'kg-cp-num kg-cp-yn')));

    (c.lines ?? []).forEach((g) => o.push(this.lineSvg(g.through ? lineThrough(...g.through) : g.x !== undefined ? { m: null, c: null, x: g.x } : { m: g.m ?? 0, c: g.c ?? 0 }, `kg-cp-given t${g.tone ?? 0}${g.dash ? ' dash' : ''}`)));
    (c.graphs ?? []).forEach((g, i) => {
      const pieces = sample(this.toks[i], this.x0, this.x1, this.y0, this.y1, Math.ceil(((this.x1 - this.x0) / sx) * U / 3), this.vals);
      const cls = g.params ? 'kg-cp-graph' : `kg-cp-given t${g.tone ?? 0}${g.dash ? ' dash' : ''}`;
      pieces.forEach((pc) => o.push(`<polyline class="${cls}" points="${pc.map((p) => `${this.sx(p[0])},${this.sy(p[1])}`).join(' ')}"/>`));
    });

    const line = this.line();
    if (c.mode === 'line') o.push(this.lineSvg(line, 'kg-cp-line'));
    // step triangle: run along, then rise up (or down), between the handles or over one square from the y-axis
    if (show.includes('gradient') && line && (line.m !== null || this.handles.length === 2)) {
      const [a, b] = this.handles.length === 2 ? [...this.handles].sort((p, q) => p[0] - q[0]) : [[0, line.c!], [sx, tidy(line.c! + line.m! * sx)]] as P[];
      const corner: P = [b[0], a[1]], [run, rise] = step(a, b), up = rise >= 0;
      // keep the two numbers off the axis numbers: slide them along their leg, away from the axes
      let rx = (this.sx(a[0]) + this.sx(corner[0])) / 2, ry = (this.sy(corner[1]) + this.sy(b[1])) / 2 + 5;
      if (Math.abs(rx - X) < 18) rx += rx < X ? -16 : 16;
      if (Math.abs(ry - 5 - Y) < 18) ry += ry - 5 < Y ? -14 : 14;
      o.push(this.seg(a, corner, 'kg-cp-run'), this.seg(corner, b, 'kg-cp-rise'),
        this.text(rx, this.sy(a[1]) + (up ? 20 : -9), this.d(run), 'kg-cp-num kg-cp-runl'),
        this.text(this.sx(corner[0]) + 14, ry, this.d(rise), 'kg-cp-num kg-cp-risel'));
    }
    if (show.includes('intercept') && line && line.c !== null && line.c >= this.y0 && line.c <= this.y1 && this.x0 <= 0 && this.x1 >= 0)
      o.push(`<circle class="kg-cp-int" cx="${this.sx(0)}" cy="${this.sy(line.c)}" r="9"/>`);
    this.mod?.draw(o);

    // given points, then the learner's points and handles (each a 44px target, focusable, arrow keys move it)
    const given = c.given ?? [];
    given.forEach((p, i) => {
      o.push(`<circle class="kg-cp-gv" cx="${this.sx(p[0])}" cy="${this.sy(p[1])}" r="6"/>`);
      if (c.labels) o.push(this.text(this.sx(p[0]) - 13, this.sy(p[1]) - 10, this.letter(i), 'kg-cp-lt'));
    });
    const item = (kind: 'p' | 'h', p: P, i: number, name: string) =>
      `<g class="kg-cp-${kind}${i === this.active ? ' on' : ''}" data-${kind}="${i}" tabindex="0" role="button" aria-label="${esc(`${name} (${this.d(p[0])}, ${this.d(p[1])})`)}">` +
      `<circle class="kg-cp-hit" cx="${this.sx(p[0])}" cy="${this.sy(p[1])}" r="${HIT}"/><circle class="kg-cp-dot" cx="${this.sx(p[0])}" cy="${this.sy(p[1])}" r="${kind === 'h' ? 10 : 8}"/>` +
      (c.labels ? this.text(this.sx(p[0]) + 15, this.sy(p[1]) - 11, this.letter(given.length + i), 'kg-cp-lt') : '') + '</g>';
    this.handles.forEach((p, i) => o.push(item('h', p, i, c.labels ? this.letter(given.length + i) : this.lab('label-handle', 'Point'))));
    this.pts.forEach((p, i) => o.push(item('p', p, i, c.labels ? this.letter(given.length + i) : this.lab('label-point', 'Point'))));
    const g0 = (c.graphs ?? []).findIndex((g) => g.params);
    if (this.traceX !== null && g0 >= 0) {
      const y = valueAt(this.toks[g0], this.traceX, this.vals);
      if (Number.isFinite(y)) o.push(this.seg([this.traceX, this.y0], [this.traceX, this.y1], 'kg-cp-tline'), `<circle class="kg-cp-trace" cx="${this.sx(this.traceX)}" cy="${this.sy(y)}" r="8"/>`);
    }
    if ((this.mode === 'points' || this.mod) && this.svg.matches(':focus-visible'))
      o.push(`<circle class="kg-cp-cur" cx="${this.sx(this.cursor[0])}" cy="${this.sy(this.cursor[1])}" r="15"/>`);
    this.svg.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
    this.svg.setAttribute('width', W.toFixed(1));
    return o;
  }

  /** The parts that don't change while the learner works: hint, sliders, table, tools. */
  private mkParts() {
    if (!this.parts) {
      const mk = (k: string) => Object.assign(document.createElement(k === 'main' || k === 'sliders' || k === 'table' ? 'div' : 'p'), { className: `kg-cp-${k}` });
      this.parts = { hint: mk('hint'), main: mk('main'), sliders: mk('sliders'), table: mk('table'), facts: mk('facts'), tools: mk('tools'), live: mk('live') };
      this.parts.main.dir = this.parts.sliders.dir = 'ltr';
      this.parts.main.append(this.svg);
      this.parts.live.setAttribute('aria-live', 'polite');
      this.replaceChildren(...Object.values(this.parts));
    }
  }

  private build() {
    this.mkParts();
    const c = this.cfg, p = this.parts, set = (el: HTMLElement, html: string) => { el.innerHTML = html; el.hidden = !html; };
    set(p.hint, c.instruction ? `<span class="kg-cp-i i-${esc(c.instruction)}" aria-hidden="true"></span>${esc(this.lab(`instruction-${c.instruction}`))}` : '');
    const keys = [...(c.line?.sliders ? Object.keys(c.line.sliders) : []), ...(c.graphs ?? []).flatMap((g) => Object.keys(g.params ?? {}))];
    set(p.sliders, keys.map((k) => {
      const [lo, hi, st] = this.range(k), name = esc(this.lab(`label-${k}`, k));
      return `<div class="kg-cp-sl"><span class="kg-cp-sl-name" dir="auto">${name} <output data-k="${k}">${this.numHTML(this.vals[k])}</output></span>` +
        `<button type="button" class="secondary kg-cp-btn" data-act="dec" data-k="${k}" aria-label="${esc(this.lab('label-less', '−', { p: this.lab(`label-${k}`, k) }))}">−</button>` +
        `<input type="range" data-k="${k}" min="${lo}" max="${hi}" step="${st}" value="${this.vals[k]}" aria-label="${name}" aria-valuetext="${esc(this.d(this.vals[k]))}">` +
        `<button type="button" class="secondary kg-cp-btn" data-act="inc" data-k="${k}" aria-label="${esc(this.lab('label-more', '+', { p: this.lab(`label-${k}`, k) }))}">+</button></div>`;
    }).join(''));
    const tx = c.table?.x ?? [];
    set(p.table, tx.length ? `<table><tr><th scope="row">x</th>${tx.map((x) => `<td><bdi dir="ltr">${esc(this.d(x))}</bdi></td>`).join('')}</tr>` +
      `<tr><th scope="row">y</th>${tx.map((x, i) => `<td><input data-cell="${i}" inputmode="decimal" autocomplete="off" aria-label="${esc(this.lab('label-cell', 'y when x = {x}', { x: this.d(x) }))}"></td>`).join('')}</tr></table>` : '');
    set(p.tools, (c.mode === 'points' ? `<button type="button" class="secondary kg-cp-btn" data-act="clear">${esc(this.lab('label-clear', 'Clear'))}</button>` : '') + (this.mod?.tools?.() ?? ''));
    this.render();
  }

  render() {
    if (!this.parts) return;
    const p = this.parts, c = this.cfg, show = c.show ?? [];
    const a = document.activeElement, keep = a && this.svg.contains(a) && a !== this.svg ? (a.getAttribute('data-focus') ? `[data-focus="${a.getAttribute('data-focus')}"]` : [...a.attributes].filter((x) => /^data-[ph]$/.test(x.name)).map((x) => `[${x.name}="${this.active}"]`).join('')) : '';
    const svg = this.svg;
    svg.innerHTML = this.draw().join('');
    svg.setAttribute('class', `kg-cp-svg m-${this.mode}`);
    svg.setAttribute('aria-label', this.lab('label-plane', 'Coordinate plane'));
    if (this.mode === 'points' || c.trace || this.mod) { svg.setAttribute('tabindex', '0'); svg.setAttribute('role', 'application'); }
    else svg.setAttribute('role', 'img');
    if (keep) svg.querySelector<SVGElement>(keep)?.focus();
    // readouts under the plane
    const line = this.line(), facts: string[] = [];
    if (show.includes('equation') && line) facts.push(`${esc(this.lab('label-equation', ''))} ${this.equation(line)}`);
    if (show.includes('gradient') && line && this.handles.length === 2) {
      const [l, r] = [...this.handles].sort((u, v) => u[0] - v[0]), [run, rise] = step(l, r);
      facts.push(this.labHTML('label-step', 'run {run}, rise {rise}', { run: this.d(run), rise: this.d(rise) }));
    }
    const at = this.mode === 'points' ? this.pts[this.active] : this.mode === 'line' ? this.handles[this.active] : undefined;
    if (show.includes('coords') && at) facts.push(this.coords(at));
    const g0 = (c.graphs ?? []).findIndex((g) => g.params);
    if (this.traceX !== null && g0 >= 0) {
      const y = valueAt(this.toks[g0], this.traceX, this.vals);
      if (Number.isFinite(y)) facts.push(this.coords([this.traceX, tidy(y)]));
    }
    if (this.mod?.facts) facts.push(...this.mod.facts());
    p.facts.innerHTML = facts.map((f) => `<span>${f}</span>`).join('');
    // keep the readout's room while it is empty, so the plane never jumps under a dragging finger
    p.facts.hidden = !show.length && !c.trace && !this.mod?.facts;
    p.live.textContent = this.mod?.live?.(this.cursor) || (svg.matches(':focus') && this.mode === 'points' ? `${this.d(this.cursor[0])}, ${this.d(this.cursor[1])}` : at ? `${this.d(at[0])}, ${this.d(at[1])}` : '');
  }
}

customElements.define('kg-coord-plane', CoordPlane);
