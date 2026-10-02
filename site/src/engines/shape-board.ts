// <kg-shape-board>: a dot geoboard / square grid / coordinate grid. The learner taps points to draw polygons, paths,
// segments, lines and rays, places points, shades cells, taps shapes to pick them, slides and turns pieces, and draws
// circles with a compass. The 3D views (cube builder on isometric dots, solid shapes) load on demand from
// shape-board/iso.ts. Geometry and the check: engines/lib/shape-board-*.ts. Contract: docs/STUDIOS.md.
// The board is LTR in every locale (x grows to the right, y upwards, as on both countries' coordinate grids).
import { angles, area, circleCircle, classify, clean, lineCircle, lineLine, perimeter, rotate, samePt, translate, type Circle, type P, type Seg } from './lib/shape-board-geom';
import type { Drawn, DrawnKind, ShapeBoardState } from './lib/shape-board-check';

export interface Given {
  /** Corners (a closed polygon unless `open`), or the two points of a segment / line / ray (`line`). */
  pts?: P[];
  open?: boolean;
  line?: 'segment' | 'line' | 'ray';
  circle?: Circle;
  /** Colour 0–5. */
  tone?: number;
  /** Engine label `label-<name>`: its spoken name. */
  name?: string;
  /** Letter the corners (engine label `letters`). */
  labels?: boolean;
  dash?: boolean;
  /** select mode: false = not tappable. */
  select?: boolean;
  /** move mode: a piece the learner slides; `turn` = and turns in quarter turns about `pivot` (default its first corner). */
  move?: boolean;
  turn?: boolean;
  pivot?: P;
}

export interface ShapeBoardConfig {
  /** Board extent in units (default 0..6 both ways). */
  x?: [number, number];
  y?: [number, number];
  /** dots = geoboard (default), lines = square grid, none. */
  grid?: 'dots' | 'lines' | 'none';
  /** Numbered x and y axes through 0 (four quadrants when x/y go below 0). */
  axes?: boolean;
  /** Snap step (default 1; 0.5 = half units). */
  step?: number;
  shapes?: Given[];
  /** A fixed dashed mirror / fold line through two points. */
  mirror?: Seg;
  mode?: 'polygon' | 'path' | 'segment' | 'line' | 'ray' | 'points' | 'select' | 'cells' | 'move' | 'view';
  /** Most shapes (or points, cells) the learner may draw; at the limit a new shape replaces the oldest. Default 1 (points/cells: no limit). */
  max?: number;
  /** path mode: corners per path (3 = an angle arm–corner–arm). */
  corners?: number;
  /** Add a compass: tap the centre, then a point on the circle. Crossings become snap points. */
  compass?: boolean;
  /** Letter the corners the learner draws. */
  labels?: boolean;
  /** lengths, angles, right (right-angle marks), corner (a square corner card at each angle), area, perimeter, coords, count. */
  show?: string[];
  /** Number tiles for the answer (grade 1: no typing). */
  pick?: [number, number];
  /** Icon hint + engine label `instruction-<name>`: draw, line, tap, points, cells, move, fold, compass, build. */
  instruction?: string;
  /** 3D views (shape-board/iso.ts). */
  cubes?: unknown;
  solids?: unknown;
}

const NS = 'http://www.w3.org/2000/svg';
const U = 44; // svg units per board unit
type Piece = { at: P; turn: number };
interface Snap { drawn: Drawn[]; points: P[]; cells: P[]; selected: number[]; pieces: Piece[]; circles: Circle[] }
type Parts = Record<'hint' | 'main' | 'tools' | 'facts' | 'pick' | 'live', HTMLElement>;
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const DRAW = ['polygon', 'path', 'segment', 'line', 'ray'];

export class ShapeBoard extends HTMLElement {
  cfg: ShapeBoardConfig = {};
  private s: Snap = { drawn: [], points: [], cells: [], selected: [], pieces: [], circles: [] };
  private hist: string[] = [];
  private open = -1; // index of the shape being drawn
  private cursor: P = [0, 0];
  private tool: 'pen' | 'compass' = 'pen';
  private centre: P | null = null;
  private last: P | null = null;
  private active = 0; // piece
  private drag: { v?: [number, number]; k?: number; from: P; at: P; moved: boolean } | null = null;
  picked: number | null = null;
  private svg = document.createElementNS(NS, 'svg');
  private parts?: Parts;
  private iso?: { root: HTMLElement; state(): Partial<ShapeBoardState> };
  private wired = false;
  ready: Promise<void> = Promise.resolve();

  set config(c: ShapeBoardConfig) {
    this.cfg = c;
    this.s = { drawn: [], points: [], cells: [], selected: [], pieces: (c.shapes ?? []).filter((g) => g.move).map(() => ({ at: [0, 0], turn: 0 })), circles: [] };
    this.hist = [];
    this.open = -1;
    this.picked = null;
    this.iso = undefined;
    this.cursor = [Math.ceil(this.x0), Math.ceil(this.y0)];
    if (c.cubes || c.solids)
      this.ready = import('./shape-board/iso').then((m) => {
        this.iso = m.mountIso(this, c);
        this.render();
      });
    this.render();
  }

  get state(): { board: ShapeBoardState } {
    const s = this.s;
    return {
      board: {
        drawn: copy(s.drawn), points: copy(s.points), cells: copy(s.cells), selected: [...s.selected].sort((a, b) => a - b),
        pieces: s.pieces.map((p, i) => ({ ...copy(p), pts: this.piecePts(i) })), circles: copy(s.circles),
        given: (this.cfg.shapes ?? []).map((g) => ({ kind: g.line ? 'segment' : g.open ? 'path' : 'polygon', pts: g.pts ?? [], closed: !g.open && !g.line })),
        picked: this.picked, ...this.iso?.state(),
      },
    };
  }

  // ---------- board geometry ----------
  private get x0() { return this.cfg.x?.[0] ?? 0; }
  private get x1() { return this.cfg.x?.[1] ?? 6; }
  private get y0() { return this.cfg.y?.[0] ?? 0; }
  private get y1() { return this.cfg.y?.[1] ?? 6; }
  private get step() { return this.cfg.step ?? 1; }
  private get M() { return this.cfg.axes ? 32 : 22; }
  private sx = (x: number) => +(this.M + (x - this.x0) * U).toFixed(1);
  private sy = (y: number) => +(this.M + (this.y1 - y) * U).toFixed(1);
  private xy = (p: P) => `${this.sx(p[0])},${this.sy(p[1])}`;
  private get mode() { return this.cfg.mode ?? 'view'; }
  private get max() { return this.cfg.max ?? (this.mode === 'points' || this.mode === 'cells' ? 1e9 : 1); }

  /** Locale digits, minus sign and decimal mark. */
  d(n: number | string) {
    const dg = this.dataset.digits ?? '0123456789';
    return String(n).replace(/-/g, '−').replace(/[0-9]/g, (x) => dg[+x]).replace('.', this.dataset.decimal ?? '.');
  }
  /** Engine label (studio JSON "engine"), with {name} placeholders. */
  lab(k: string, fb = '', vars: Record<string, string> = {}) {
    return (this.dataset[k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] ?? fb).replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? '');
  }
  private letter(i: number) {
    const l = (this.dataset.letters ?? 'A B C D E F G H I J K L').split(/[\s,،]+/);
    return l[i % l.length];
  }
  private num = (v: number) => this.d(Math.round(v * 100) / 100);

  private piecePts(i: number): P[] {
    const g = (this.cfg.shapes ?? []).filter((s) => s.move)[i], p = this.s.pieces[i];
    return g.pts!.map((q) => translate(rotate(q, g.pivot ?? g.pts![0], p.turn), p.at));
  }

  /** The grid point, or construction point, nearest a board position. */
  private snap(q: P): P {
    let best: P | null = null, bd = 0.35;
    for (const e of this.extraPoints()) { const d = Math.hypot(e[0] - q[0], e[1] - q[1]); if (d < bd) { bd = d; best = e; } }
    if (best) return best;
    const st = this.step, r = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v / st) * st));
    return [r(q[0], this.x0, this.x1), r(q[1], this.y0, this.y1)];
  }

  /** With the compass: corners of given shapes, circle centres, and where circles and lines cross. */
  private extraPoints(): P[] {
    if (!this.cfg.compass) return [];
    const gs = this.cfg.shapes ?? [], circles = [...this.s.circles, ...gs.filter((g) => g.circle).map((g) => g.circle!)];
    const segs: Seg[] = [...this.s.drawn, ...gs].flatMap((d) => (d.pts ?? []).slice(1).map((q, i): Seg => [d.pts![i], q]));
    const out: P[] = [...circles.map((c): P => [c[0], c[1]]), ...gs.flatMap((g) => g.pts ?? [])];
    circles.forEach((c, i) => {
      circles.slice(i + 1).forEach((e) => out.push(...circleCircle(c, e)));
      segs.forEach((s) => out.push(...lineCircle(s, c)));
    });
    segs.forEach((s, i) => segs.slice(i + 1).forEach((t) => { const p = lineLine(s, t); if (p) out.push(p); }));
    return out.filter((p) => p[0] >= this.x0 - 1e-9 && p[0] <= this.x1 + 1e-9 && p[1] >= this.y0 - 1e-9 && p[1] <= this.y1 + 1e-9);
  }

  private toBoard(e: PointerEvent): P {
    const r = this.svg.getBoundingClientRect(), vb = this.svg.viewBox.baseVal;
    const px = ((e.clientX - r.left) * vb.width) / (r.width || 1), py = ((e.clientY - r.top) * vb.height) / (r.height || 1);
    return [this.x0 + (px - this.M) / U, this.y1 - (py - this.M) / U];
  }

  // ---------- actions ----------
  private save() {
    this.hist.push(JSON.stringify([this.s, this.open]));
    if (this.hist.length > 60) this.hist.shift();
  }
  changed() {
    this.render();
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  /** A tap (or Enter) at board position q. */
  private tap(q: P, target?: Element | null) {
    const m = this.mode, s = this.s;
    if (m === 'view' || m === 'move' || this.iso) return;
    if (m === 'select') {
      const i = Number(target?.closest('[data-g]')?.getAttribute('data-g') ?? NaN);
      if (Number.isNaN(i)) return;
      this.save();
      s.selected = s.selected.includes(i) ? s.selected.filter((j) => j !== i) : [...s.selected, i];
      return this.changed();
    }
    if (m === 'cells') {
      const c: P = [Math.floor(q[0]), Math.floor(q[1])];
      if (c[0] < this.x0 || c[0] >= this.x1 || c[1] < this.y0 || c[1] >= this.y1) return;
      this.save();
      const k = s.cells.findIndex((x) => samePt(x, c));
      if (k >= 0) s.cells.splice(k, 1);
      else if (s.cells.length < this.max) s.cells.push(c);
      return this.changed();
    }
    const p = this.snap(q);
    this.last = this.cursor = p;
    this.save();
    if (this.tool === 'compass') {
      if (!this.centre) this.centre = p;
      else {
        const r = Math.hypot(p[0] - this.centre[0], p[1] - this.centre[1]);
        if (r > 1e-6) s.circles.push([...this.centre, r]);
        this.centre = null;
      }
      return this.changed();
    }
    if (m === 'points') {
      const k = s.points.findIndex((x) => samePt(x, p));
      if (k >= 0) s.points.splice(k, 1);
      else if (s.points.length < this.max) s.points.push(p);
      return this.changed();
    }
    // polygon, path, segment, line, ray
    let cur = s.drawn[this.open];
    if (!cur) {
      if (s.drawn.length >= this.max) s.drawn.shift();
      cur = { kind: m as DrawnKind, pts: [] };
      if (m === 'polygon') cur.closed = false;
      s.drawn.push(cur);
      this.open = s.drawn.length - 1;
    }
    const pts = cur.pts, n = pts.length;
    if (m === 'polygon' && n >= 3 && samePt(p, pts[0])) {
      cur.closed = true;
      this.open = -1;
    } else if (n && samePt(p, pts[n - 1])) {
      if (m === 'path' && n > 1) this.open = -1; // tapping the last corner again ends a path
    } else {
      pts.push(p);
      if (m === 'path' ? this.cfg.corners && pts.length >= this.cfg.corners : m !== 'polygon' && pts.length >= 2) this.open = -1;
    }
    this.changed();
  }

  private undo() {
    const h = this.hist.pop();
    if (!h) return;
    [this.s, this.open] = JSON.parse(h);
    this.centre = null;
    this.changed();
  }
  private clear() {
    this.save();
    this.s = { drawn: [], points: [], cells: [], selected: [], pieces: this.s.pieces.map((): Piece => ({ at: [0, 0], turn: 0 })), circles: [] };
    this.open = -1;
    this.centre = null;
    this.changed();
  }
  private movePiece(k: number, at: P, turn = 0) {
    const p = this.s.pieces[k];
    if (!p) return;
    const before = JSON.stringify(p);
    p.at = at;
    p.turn += turn;
    // keep it on the board
    const pts = this.piecePts(k), xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    p.at = [p.at[0] + Math.max(0, this.x0 - Math.min(...xs)) - Math.max(0, Math.max(...xs) - this.x1), p.at[1] + Math.max(0, this.y0 - Math.min(...ys)) - Math.max(0, Math.max(...ys) - this.y1)];
    this.active = k;
    if (JSON.stringify(p) !== before) this.changed();
    else this.render();
  }

  connectedCallback() {
    if (this.wired) return;
    this.wired = true;
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.dragTo(e));
    svg.addEventListener('pointerup', (e) => {
      const d = this.drag;
      this.drag = null;
      if (d && !d.moved && d.v) this.tap(this.toBoard(e));
    });
    svg.addEventListener('pointercancel', () => (this.drag = null));
    // show or hide the keyboard cursor once focus has settled (re-rendering mid-blur would drop the new focus)
    const later = () => setTimeout(() => DRAW.concat('points', 'cells').includes(this.mode) && this.render());
    svg.addEventListener('focus', later);
    svg.addEventListener('blur', later);
    this.addEventListener('keydown', (e) => this.key(e));
    this.addEventListener('click', (e) => {
      const b = (e.target as Element).closest<HTMLElement>('[data-act]');
      const a = b?.dataset.act;
      if (a === 'undo') this.undo();
      else if (a === 'clear') this.clear();
      else if (a === 'pen' || a === 'compass') { this.tool = a; this.centre = null; this.render(); }
      else if (a === 'cw' || a === 'acw') { this.save(); this.movePiece(this.active, this.s.pieces[this.active]?.at ?? [0, 0], a === 'cw' ? -90 : 90); }
      else if (a === 'pick') { this.picked = Number(b!.dataset.n); this.changed(); }
    });
  }

  private down(e: PointerEvent) {
    const m = this.mode;
    if (m === 'view' || this.iso) return;
    const q = this.toBoard(e), t = e.target as Element;
    if (m === 'move') {
      const k = Number(t.closest('[data-k]')?.getAttribute('data-k') ?? NaN);
      if (Number.isNaN(k)) return;
      e.preventDefault();
      this.save();
      this.active = k;
      this.drag = { k, from: q, at: this.s.pieces[k].at, moved: false };
      this.svg.setPointerCapture?.(e.pointerId);
      return this.render();
    }
    if (DRAW.includes(m) && this.tool === 'pen') {
      // grab a corner already drawn, to move it
      let best: [number, number] | undefined, bd = 0.4;
      this.s.drawn.forEach((d, i) => d.pts.forEach((p, j) => { const dd = Math.hypot(p[0] - q[0], p[1] - q[1]); if (dd < bd) { bd = dd; best = [i, j]; } }));
      if (best) {
        this.drag = { v: best, from: q, at: q, moved: false };
        this.svg.setPointerCapture?.(e.pointerId);
        return;
      }
    }
    this.tap(q, t);
  }

  private dragTo(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    const q = this.toBoard(e), st = this.step;
    if (d.k !== undefined) {
      const at: P = [d.at[0] + Math.round((q[0] - d.from[0]) / st) * st, d.at[1] + Math.round((q[1] - d.from[1]) / st) * st];
      if (!samePt(at, this.s.pieces[d.k].at)) { d.moved = true; this.movePiece(d.k, at); }
    } else if (d.v) {
      const p = this.snap(q), pts = this.s.drawn[d.v[0]].pts;
      if (!samePt(p, pts[d.v[1]]) && (d.moved || Math.hypot(q[0] - d.from[0], q[1] - d.from[1]) > 0.5)) {
        if (!d.moved) this.save();
        d.moved = true;
        pts[d.v[1]] = this.last = p;
        this.changed();
      }
    }
  }

  private key(e: KeyboardEvent) {
    const t = e.target as Element, k = e.key;
    const dir: Record<string, P> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const piece = t.closest('[data-k]'), g = t.closest('[data-g]');
    if (piece && dir[k]) {
      e.preventDefault();
      const i = Number(piece.getAttribute('data-k')), at = this.s.pieces[i].at;
      this.save();
      return this.movePiece(i, [at[0] + dir[k][0] * this.step, at[1] + dir[k][1] * this.step]);
    }
    const enter = k === 'Enter' || k === ' ';
    if (g && enter) { e.preventDefault(); return this.tap([0, 0], g); }
    if (t !== this.svg) return;
    const cells = this.mode === 'cells';
    if (dir[k]) {
      e.preventDefault();
      const st = cells ? 1 : this.step, cl = (v: number, a: number, b: number) => Math.min(cells ? b - 1 : b, Math.max(a, v));
      this.cursor = [cl(this.cursor[0] + dir[k][0] * st, this.x0, this.x1), cl(this.cursor[1] + dir[k][1] * st, this.y0, this.y1)];
      this.render();
    } else if (enter) {
      e.preventDefault();
      this.tap(cells ? [this.cursor[0] + 0.5, this.cursor[1] + 0.5] : this.cursor);
    } else if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault();
      this.undo();
    }
  }

  // ---------- drawing ----------
  /** Clip the line through a, b (ray: from a) to the board. */
  private extend(a: P, b: P, ray: boolean): Seg {
    const d: P = [b[0] - a[0], b[1] - a[1]];
    let lo = ray ? 0 : -1e9, hi = 1e9;
    ([[0, this.x0, this.x1], [1, this.y0, this.y1]] as const).forEach(([k, mn, mx]) => {
      if (Math.abs(d[k]) < 1e-12) return;
      const t1 = (mn - a[k]) / d[k], t2 = (mx - a[k]) / d[k];
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    });
    return [translate(a, [lo * d[0], lo * d[1]]), translate(a, [hi * d[0], hi * d[1]])];
  }
  private line(a: P, b: P, cls: string) {
    return `<line class="${cls}" x1="${this.sx(a[0])}" y1="${this.sy(a[1])}" x2="${this.sx(b[0])}" y2="${this.sy(b[1])}"/>`;
  }
  /** An arrowhead at `tip`, pointing away from `from`. */
  private arrow(from: P, tip: P, cls: string) {
    const tx = this.sx(tip[0]), ty = this.sy(tip[1]), dx = tx - this.sx(from[0]), dy = ty - this.sy(from[1]), l = Math.hypot(dx, dy) || 1;
    const u = [dx / l, dy / l], at = (b: number, s: number) => `${(tx - u[0] * b - u[1] * s).toFixed(1)},${(ty - u[1] * b + u[0] * s).toFixed(1)}`;
    return `<polygon class="${cls} kg-sb-arrow" points="${tx},${ty} ${at(14, 7)} ${at(14, -7)}"/>`;
  }
  private dot(p: P, cls: string, r: number) {
    return `<circle class="${cls}" cx="${this.sx(p[0])}" cy="${this.sy(p[1])}" r="${r}"/>`;
  }

  private shapeSvg(pts: P[], kind: string, closed: boolean, cls: string) {
    if ((kind === 'line' || kind === 'ray') && pts.length > 1) {
      // lines go on for ever both ways, rays one way: arrowheads at the board edge, as in the books
      const [a, b] = this.extend(pts[0], pts[1], kind === 'ray');
      return this.line(a, b, cls) + (kind === 'line' ? this.arrow(b, a, cls) : '') + this.arrow(a, b, cls);
    }
    const tag = closed ? 'polygon' : 'polyline';
    return `<${tag} class="${cls}${closed ? ' closed' : ''}" points="${pts.map(this.xy).join(' ')}"/>`;
  }

  /** Letters, lengths, angle sizes, right-angle marks and square-corner cards for one shape. */
  private marks(pts: P[], closed: boolean, letters: number | null, out: string[]) {
    const show = this.cfg.show ?? [], n = pts.length;
    if (!n) return;
    const c: P = [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
    const away = (p: P, r: number, cls: string, text: string) => {
      const v = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(v[0], v[1]) || 1;
      out.push(`<text class="${cls}" x="${(this.sx(p[0]) + (v[0] / l) * r).toFixed(1)}" y="${(this.sy(p[1]) - (v[1] / l) * r + 6).toFixed(1)}">${text}</text>`);
    };
    if (letters !== null) pts.forEach((p, i) => away(p, 18, 'kg-sb-lt', esc(this.letter(letters + i))));
    if (!closed || n < 3) {
      if (n === 3 && show.includes('corner')) out.push(this.corner(pts[1], pts[0], pts[2]));
      return;
    }
    const cp = clean(pts), ang = angles(cp);
    cp.forEach((v, i) => {
      const a = cp[(i + cp.length - 1) % cp.length], b = cp[(i + 1) % cp.length], len = Math.hypot(b[0] - v[0], b[1] - v[1]);
      if (show.includes('lengths') && Math.abs(len * 2 - Math.round(len * 2)) < 1e-6) away([(v[0] + b[0]) / 2, (v[1] + b[1]) / 2], 16, 'kg-sb-len', this.num(len));
      if (show.includes('right') && Math.abs(ang[i] - 90) < 1e-4) out.push(this.corner(v, a, b, true));
      if (show.includes('corner')) out.push(this.corner(v, a, b));
      if (show.includes('angles')) away(v, -26, 'kg-sb-ang', this.num(ang[i]) + '°');
    });
  }

  /** A square corner at v along the arm to a, on b's side: a small right-angle mark, or a big see-through card. */
  private corner(v: P, a: P, b: P, small = false) {
    const len = small ? 0.28 : 1.2, u = [a[0] - v[0], a[1] - v[1]], l = Math.hypot(u[0], u[1]) || 1;
    const e: P = [(u[0] / l) * len, (u[1] / l) * len];
    const side = Math.sign(u[0] * (b[1] - v[1]) - u[1] * (b[0] - v[0])) || 1;
    const f: P = [-e[1] * side, e[0] * side];
    return `<polygon class="${small ? 'kg-sb-right' : 'kg-sb-card'}" points="${[v, translate(v, e), translate(translate(v, e), f), translate(v, f)].map(this.xy).join(' ')}"/>`;
  }

  private draw() {
    const c = this.cfg, s = this.s, m = this.mode;
    const W = (this.x1 - this.x0) * U + 2 * this.M, H = (this.y1 - this.y0) * U + 2 * this.M;
    const o: string[] = [`<rect class="kg-sb-bg" width="${W}" height="${H}"/>`];
    const xs: number[] = [], ys: number[] = [];
    for (let x = Math.ceil(this.x0); x <= this.x1; x++) xs.push(x);
    for (let y = Math.ceil(this.y0); y <= this.y1; y++) ys.push(y);
    for (const [x, y] of s.cells) o.push(`<rect class="kg-sb-cell" x="${this.sx(x)}" y="${this.sy(y + 1)}" width="${U}" height="${U}"/>`);
    const grid = c.grid ?? 'dots';
    if (grid === 'lines') {
      xs.forEach((x) => o.push(this.line([x, this.y0], [x, this.y1], 'kg-sb-grid')));
      ys.forEach((y) => o.push(this.line([this.x0, y], [this.x1, y], 'kg-sb-grid')));
    }
    if (c.axes) {
      const ax = Math.min(Math.max(0, this.x0), this.x1), ay = Math.min(Math.max(0, this.y0), this.y1);
      o.push(`<path class="kg-sb-axis" d="M${this.sx(this.x0)} ${this.sy(ay)}H${this.sx(this.x1) + 14}M${this.sx(ax)} ${this.sy(this.y0)}V${this.sy(this.y1) - 14}"/>`,
        `<text class="kg-sb-num" x="${this.sx(this.x1) + 16}" y="${this.sy(ay) - 8}">x</text><text class="kg-sb-num" x="${this.sx(ax) + 14}" y="${this.sy(this.y1) - 6}">y</text>`);
      xs.forEach((x) => o.push(`<text class="kg-sb-num" x="${this.sx(x)}" y="${this.sy(ay) + 21}">${this.d(x)}</text>`));
      ys.forEach((y) => y && o.push(`<text class="kg-sb-num" x="${this.sx(ax) - 13}" y="${this.sy(y) + 5}">${this.d(y)}</text>`));
    }
    if (grid !== 'none') xs.forEach((x) => ys.forEach((y) => o.push(this.dot([x, y], 'kg-sb-dot', grid === 'dots' ? 4 : 2.5))));

    let letters = 0, piece = 0;
    (c.shapes ?? []).forEach((g, i) => {
      const cls = `kg-sb-g t${g.tone ?? 0}${g.dash ? ' dash' : ''}${s.selected.includes(i) ? ' sel' : ''}`;
      const name = esc(g.name ? this.lab(`label-${g.name}`, g.name) : `${this.lab('label-shape', '')} ${this.d(i + 1)}`);
      const k = g.move ? piece++ : -1, pts = g.move ? this.piecePts(k) : g.pts ?? [];
      const body = g.circle
        ? `<circle class="${cls} closed" cx="${this.sx(g.circle[0])}" cy="${this.sy(g.circle[1])}" r="${g.circle[2] * U}"/>`
        : this.shapeSvg(pts, g.line ?? '', !g.open && !g.line, cls);
      // thin shapes get a wide invisible outline to tap
      const hit = g.open || g.line ? body.replace(/class="[^"]*"/g, 'class="kg-sb-hit"') : ''; // arrowheads too
      if (m === 'select' && g.select !== false)
        o.push(`<g data-g="${i}" tabindex="0" role="checkbox" aria-checked="${s.selected.includes(i)}" aria-label="${name}">${body}${hit}</g>`);
      else if (m === 'move' && g.move)
        o.push(`<g data-k="${k}" tabindex="0" role="button" class="kg-sb-piece${k === this.active ? ' on' : ''}" aria-label="${name}">${body}</g>`);
      else o.push(body);
      if (g.line) pts.forEach((p) => o.push(this.dot(p, 'kg-sb-gv', 5)));
      if (!g.circle) this.marks(pts, !g.open && !g.line, g.labels ? letters : null, o);
      if (g.labels) letters += pts.length;
    });
    if (c.mirror) o.push(this.line(...this.extend(c.mirror[0], c.mirror[1], false), 'kg-sb-mirror'));
    for (const [x, y, r] of s.circles) o.push(`<circle class="kg-sb-circle" cx="${this.sx(x)}" cy="${this.sy(y)}" r="${(r * U).toFixed(1)}"/>`, this.dot([x, y], 'kg-sb-gv', 3));

    s.drawn.forEach((d, i) => {
      const closed = !!d.closed, isOpen = i === this.open;
      o.push(this.shapeSvg(d.pts, d.kind, closed, `kg-sb-d${closed && classify(d.pts)[0] === 'crossed' ? ' bad' : ''}`));
      d.pts.forEach((p, j) => o.push(this.dot(p, `kg-sb-v${!j && isOpen && d.kind === 'polygon' && d.pts.length > 2 ? ' first' : ''}`, 7)));
      this.marks(d.pts, closed, c.labels ? letters : null, o);
      if (c.labels) letters += d.pts.length;
    });
    s.points.forEach((p, i) => {
      o.push(this.dot(p, 'kg-sb-pt', 8));
      if (c.labels) o.push(`<text class="kg-sb-lt" x="${this.sx(p[0]) + 15}" y="${this.sy(p[1]) - 10}">${esc(this.letter(letters + i))}</text>`);
    });
    if (this.centre) o.push(this.dot(this.centre, 'kg-sb-centre', 10));
    const draws = m !== 'select' && m !== 'move' && m !== 'view';
    if (draws && this.svg.matches(':focus-visible')) {
      const [x, y] = this.cursor;
      o.push(m === 'cells' ? `<rect class="kg-sb-cur" x="${this.sx(x)}" y="${this.sy(y + 1)}" width="${U}" height="${U}"/>` : this.dot(this.cursor, 'kg-sb-cur', 16));
    }
    const svg = this.svg;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', `kg-sb-svg m-${m}`);
    svg.style.maxInlineSize = `${Math.round(W * 1.6)}px`;
    if (draws) {
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('role', 'application');
    }
    svg.setAttribute('aria-label', this.lab('label-board', 'Board'));
    svg.innerHTML = o.join('');
  }

  render() {
    if (!this.parts) {
      const mk = (cls: string) => Object.assign(document.createElement(cls === 'main' ? 'div' : 'p'), { className: `kg-sb-${cls}` });
      this.parts = { hint: mk('hint'), main: mk('main'), tools: mk('tools'), facts: mk('facts'), pick: mk('pick'), live: mk('live') };
      this.parts.main.dir = this.parts.pick.dir = 'ltr';
      this.parts.live.setAttribute('aria-live', 'polite');
      this.parts.pick.setAttribute('role', 'radiogroup');
      this.replaceChildren(...Object.values(this.parts));
    }
    // keep keyboard focus on the same control across re-renders
    const a = document.activeElement, keep = a && a !== this.svg && this.contains(a) ? [...a.attributes].filter((x) => x.name.startsWith('data-')).map((x) => `[${x.name}="${x.value}"]`).join('') : '';
    const p = this.parts, c = this.cfg, s = this.s, m = this.mode, show = c.show ?? [];
    const view = this.iso?.root ?? this.svg;
    if (!this.iso) this.draw();
    if (p.main.firstChild !== view) p.main.replaceChildren(view);
    const set = (el: HTMLElement, html: string) => { el.innerHTML = html; el.hidden = !html; };
    const btn = (act: string, text: string, extra = '') => `<button type="button" class="secondary kg-sb-btn" data-act="${act}"${extra}>${text}</button>`;
    set(p.hint, c.instruction ? `<span class="kg-sb-i i-${esc(c.instruction)}" aria-hidden="true"></span>${esc(this.lab(`instruction-${c.instruction}`))}` : '');
    let tools = '';
    if (c.compass) for (const t of ['pen', 'compass']) tools += btn(t, esc(this.lab(`label-${t}`, t)), ` aria-pressed="${this.tool === t}"`);
    if (m === 'move' && (c.shapes ?? []).some((g) => g.turn)) tools += btn('acw', '↺', ` aria-label="${esc(this.lab('label-turn-acw', 'Turn anticlockwise'))}"`) + btn('cw', '↻', ` aria-label="${esc(this.lab('label-turn-cw', 'Turn clockwise'))}"`);
    if (m !== 'view' && !this.iso) tools += btn('undo', esc(this.lab('label-undo', 'Undo'))) + btn('clear', esc(this.lab('label-clear', 'Clear')));
    set(p.tools, tools);
    // readouts about the closed shape drawn last (or the cells shaded)
    const poly = [...s.drawn].reverse().find((d) => d.closed), facts: string[] = [];
    const fact = (k: string, fb: string, v: number) => facts.push(esc(this.lab(k, fb, { n: this.num(v) })));
    if (show.includes('area') && (poly || m === 'cells')) fact('label-area', 'Area: {n}', poly ? area(poly.pts) : s.cells.length);
    if (show.includes('perimeter') && poly) fact('label-perimeter', 'Perimeter: {n}', perimeter(poly.pts));
    if (show.includes('count')) fact('label-count', '{n}', m === 'cells' ? s.cells.length : m === 'points' ? s.points.length : s.selected.length);
    if (show.includes('coords') && this.last) {
      const xy = { x: this.d(this.last[0]), y: this.d(this.last[1]) }, f = this.lab('label-coords', '({x}, {y})', xy);
      // a format with a line break is written as a column in brackets, x on top (Iran's books; class .vec in global.css)
      const col = f.split('\n'), aria = esc(`${xy.x}, ${xy.y}`);
      facts.push(col.length > 1 ? `<span class="vec kg-sb-coords" role="math" aria-label="${aria}">${col.map((l) => `<span>${esc(l)}</span>`).join('')}</span>` : `<bdi dir="ltr" class="kg-sb-coords">${esc(f)}</bdi>`);
    }
    set(p.facts, facts.map((f) => `<span>${f}</span>`).join(''));
    let tiles = '';
    if (c.pick) for (let n = c.pick[0]; n <= c.pick[1]; n++) tiles += `<button type="button" role="radio" class="kg-sb-tile" data-act="pick" data-n="${n}" aria-checked="${this.picked === n}">${this.d(n)}</button>`;
    set(p.pick, tiles);
    p.pick.setAttribute('aria-label', this.lab('label-answer', 'Answer'));
    // screen readers: where the cursor is, and corners so far
    const open = s.drawn[this.open];
    p.live.textContent = this.svg.matches(':focus') ? `${this.d(this.cursor[0])}, ${this.d(this.cursor[1])}${open ? ' · ' + this.lab('label-corners', '{n}', { n: this.d(open.pts.length) }) : ''}` : '';
    if (keep) this.querySelector<HTMLElement>(keep)?.focus();
  }
}

customElements.define('kg-shape-board', ShapeBoard);
