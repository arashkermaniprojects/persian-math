// Dynamic geometry for <kg-shape-board> (module shape-board/dynamic.ts): a figure of named points, some free, some
// gliding on a line or circle, some built from others (midpoint, crossing, foot, a parallel through a point…), so
// constructions stay attached while the learner drags. Pure: the module draws it, the check reads its readouts.
// Point names are written in strings separated by spaces: "A B" a line or length, "A B C" the angle at B.
import { angleAt, circleCircle, dist, lineCircle, lineLine, type Circle, type P, type Seg } from './shape-board-geom';

export type Names = string | string[];
/** A line: through two points, or through a point parallel / perpendicular to a line or at a fixed direction (degrees),
 *  the perpendicular bisector of a segment, or the bisector of an angle (at its middle point). */
export type LineSpec = Names | { through: string; parallel?: Names; perp?: Names; deg?: number } | { bisect: Names } | { bisector: Names };
/** A circle: centre and radius, centre and a point on it, the circle through three points, or a triangle's incircle. */
export type CircleSpec = { centre: string; r?: number; through?: string } | { circum: Names } | { incircle: Names };
export type Spec = LineSpec | CircleSpec;
export interface PointObj {
  /** Start position (a free point, or projected onto `on`). */
  at?: P;
  /** A glider: stays on this line or circle. */
  on?: Spec;
  /** On a line: keep between its two points (`segment`) or beyond the first (`ray`). */
  clamp?: 'segment' | 'ray';
  /** On a circle: start angle (degrees, anticlockwise from →), allowed `range`, snap `astep` (default 5). */
  deg?: number;
  range?: [number, number];
  astep?: number;
  /** Built points: midpoint; A + k(B − A); P + (B − A); a crossing (`n` picks one of two); a foot of a perpendicular; a circle's centre. */
  mid?: Names;
  ratio?: [string, string, number];
  add?: Names;
  meet?: [Spec, Spec];
  n?: number;
  foot?: [string, LineSpec];
  centre?: CircleSpec;
  /** A helper point: not drawn or lettered. */
  hide?: boolean;
  /** Offset of the letter from the point, in board units (default: away from the figure's middle). */
  off?: P;
}
export type PointDef = P | PointObj;
export interface WatchDef {
  key: string;
  /** One quantity: "A B C" (angle at B, degrees), "A B" (length). Terms may be numbers, and "-A B C" subtracts. */
  angle?: string;
  length?: string;
  sum?: (string | number)[];
  ratio?: [string | number, string | number];
  product?: (string | number)[];
  sin?: string;
  cos?: string;
  tan?: string;
  /** Decimal places shown and checked (default 0 for angles, 1 for lengths, 2 for ratios, products and trig). */
  dp?: number;
  /** false = tracked for the check but not shown (the learner predicts it). */
  show?: boolean;
  tone?: number;
}
export interface DynamicConfig {
  points: Record<string, PointDef>;
  /** Points the learner can drag (free points and gliders). */
  drag?: string[];
  draw?: Record<string, unknown>[];
  watch?: WatchDef[];
  /** Choices for "which stayed the same?" (labels `ask-<key>`). */
  ask?: string[];
  /** Built points a toggle can set free (and snap back): e.g. the end of a parallel line, to "un-parallel" it. */
  lock?: string[];
}

export type Pts = Record<string, P | null>;
export const toks = (n: Names) => (Array.isArray(n) ? n : String(n).trim().split(/\s+/));
const isCircle = (s: Spec): s is CircleSpec => typeof s === 'object' && !Array.isArray(s) && ('centre' in s || 'circum' in s || 'incircle' in s);
const unit = (a: P, b: P): P | null => { const l = dist(a, b); return l < 1e-9 ? null : [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const snapTo = (v: number, s: number) => (s > 0 ? Math.round(v / s) * s : v);

/** The circle through three points (null if they are in a line). */
export function circum(a: P, b: P, c: P): Circle | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const s = (p: P) => p[0] * p[0] + p[1] * p[1];
  const x = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d;
  const y = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d;
  return [x, y, dist([x, y], a)];
}
/** A triangle's incircle. */
export function incircle(a: P, b: P, c: P): Circle | null {
  const la = dist(b, c), lb = dist(a, c), lc = dist(a, b), s = la + lb + lc;
  const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  if (s < 1e-9 || area < 1e-9) return null;
  return [(la * a[0] + lb * b[0] + lc * c[0]) / s, (la * a[1] + lb * b[1] + lc * c[1]) / s, (2 * area) / s];
}

/** A figure: point definitions plus the learner's parameters (free positions, glider distances or angles). */
export class Figure {
  /** Free points: position. Line gliders: distance along the line from its first point. Circle gliders: angle. */
  par: Record<string, number | P> = {};
  /** Built points the learner has set free (lock off). */
  free: Record<string, P> = {};
  private memo: Pts = {};
  constructor(public cfg: DynamicConfig) {}

  def(n: string): PointObj {
    const d = this.cfg.points[n];
    return Array.isArray(d) ? { at: d } : d ?? {};
  }
  /** Every point (null when it cannot be built, e.g. the crossing of two parallel lines). */
  solve(): Pts {
    this.memo = {};
    for (const n of Object.keys(this.cfg.points)) this.pt(n);
    return this.memo;
  }
  pt(n: string, seen: string[] = []): P | null {
    if (n in this.memo) return this.memo[n];
    if (seen.includes(n)) return null; // a definition that loops
    const s = [...seen, n], get = (m: string) => this.pt(m, s);
    let v: P | null = null;
    const d = this.def(n);
    if (this.free[n]) v = this.free[n];
    else if (d.on) {
      const sp = d.on;
      if (isCircle(sp)) {
        const c = this.circle(sp, get);
        if (c) {
          if (this.par[n] === undefined) this.par[n] = d.deg ?? (d.at ? deg(Math.atan2(d.at[1] - c[1], d.at[0] - c[0])) : 0);
          const a = rad(this.par[n] as number);
          v = [c[0] + c[2] * Math.cos(a), c[1] + c[2] * Math.sin(a)];
        }
      } else {
        const l = this.line(sp, get), u = l && unit(...l);
        if (l && u) {
          if (this.par[n] === undefined) this.par[n] = d.at ? (d.at[0] - l[0][0]) * u[0] + (d.at[1] - l[0][1]) * u[1] : 0;
          const t = this.par[n] as number;
          v = [l[0][0] + t * u[0], l[0][1] + t * u[1]];
        }
      }
    } else if (d.mid) {
      const [a, b] = toks(d.mid).map(get);
      v = a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null;
    } else if (d.ratio) {
      const [a, b] = [get(d.ratio[0]), get(d.ratio[1])], k = d.ratio[2];
      v = a && b ? [a[0] + k * (b[0] - a[0]), a[1] + k * (b[1] - a[1])] : null;
    } else if (d.add) {
      const [p, a, b] = toks(d.add).map(get);
      v = p && a && b ? [p[0] + b[0] - a[0], p[1] + b[1] - a[1]] : null;
    } else if (d.meet) v = this.meet(d.meet[0], d.meet[1], d.n ?? 0, get);
    else if (d.foot) {
      const p = get(d.foot[0]), l = this.line(d.foot[1], get), u = l && unit(...l);
      if (p && l && u) { const t = (p[0] - l[0][0]) * u[0] + (p[1] - l[0][1]) * u[1]; v = [l[0][0] + t * u[0], l[0][1] + t * u[1]]; }
    } else if (d.centre) {
      const c = this.circle(d.centre, get);
      v = c && [c[0], c[1]];
    } else {
      if (this.par[n] === undefined) this.par[n] = d.at ?? [0, 0];
      v = this.par[n] as P;
    }
    return (this.memo[n] = v);
  }

  line(sp: LineSpec, get: (n: string) => P | null = (n) => this.pt(n)): Seg | null {
    if (typeof sp === 'string' || Array.isArray(sp)) {
      const [a, b] = toks(sp).map(get);
      return a && b && dist(a, b) > 1e-9 ? [a, b] : null;
    }
    if ('bisect' in sp) {
      const [a, b] = toks(sp.bisect).map(get);
      if (!a || !b || dist(a, b) < 1e-9) return null;
      const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return [m, [m[0] - (b[1] - a[1]), m[1] + (b[0] - a[0])]];
    }
    if ('bisector' in sp) {
      const [a, v, b] = toks(sp.bisector).map(get);
      const u = a && v && unit(v, a), w = b && v && unit(v, b);
      if (!v || !u || !w) return null;
      const s: P = [u[0] + w[0], u[1] + w[1]];
      // a straight angle: the bisector is the perpendicular
      return [v, Math.hypot(...s) < 1e-9 ? [v[0] - u[1], v[1] + u[0]] : [v[0] + s[0], v[1] + s[1]]];
    }
    const p = get(sp.through);
    if (!p) return null;
    if (sp.deg !== undefined) return [p, [p[0] + Math.cos(rad(sp.deg)), p[1] + Math.sin(rad(sp.deg))]];
    const ref = this.line((sp.parallel ?? sp.perp)!, get), u = ref && unit(...ref);
    if (!u) return null;
    return [p, sp.perp ? [p[0] - u[1], p[1] + u[0]] : [p[0] + u[0], p[1] + u[1]]];
  }

  circle(sp: CircleSpec, get: (n: string) => P | null = (n) => this.pt(n)): Circle | null {
    if ('centre' in sp) {
      const c = get(sp.centre), t = sp.through ? get(sp.through) : null;
      if (!c) return null;
      const r = sp.r ?? (t ? dist(c, t) : 0);
      return r > 1e-9 ? [c[0], c[1], r] : null;
    }
    const [a, b, c] = toks('circum' in sp ? sp.circum : sp.incircle).map(get);
    if (!a || !b || !c) return null;
    return 'circum' in sp ? circum(a, b, c) : incircle(a, b, c);
  }

  private meet(s: Spec, t: Spec, n: number, get: (n: string) => P | null): P | null {
    const cs = isCircle(s), ct = isCircle(t);
    if (!cs && !ct) {
      const a = this.line(s as LineSpec, get), b = this.line(t as LineSpec, get);
      // lineLine works on whole lines (a parallel pair has no crossing)
      return a && b ? lineLine(a, b) : null;
    }
    let xs: P[] = [];
    if (cs && ct) { const a = this.circle(s as CircleSpec, get), b = this.circle(t as CircleSpec, get); xs = a && b ? circleCircle(a, b) : []; }
    else {
      const l = this.line((cs ? t : s) as LineSpec, get), c = this.circle((cs ? s : t) as CircleSpec, get);
      xs = l && c ? lineCircle(l, c) : [];
    }
    return xs[Math.min(n, xs.length - 1)] ?? null;
  }

  /**
   * Move point n towards board position q: a free point snaps to `step`; a line glider slides (its distance snapped
   * to `step`, kept on its segment or ray); a circle glider turns (snapped to `astep`, kept in `range`).
   */
  moveTo(n: string, q: P, step: number) {
    const d = this.def(n);
    if (this.free[n]) { this.free[n] = [snapTo(q[0], step), snapTo(q[1], step)]; return; }
    if (!d.on) { this.par[n] = [snapTo(q[0], step), snapTo(q[1], step)]; return; }
    this.memo = {};
    if (isCircle(d.on)) {
      const c = this.circle(d.on);
      if (!c) return;
      let a = snapTo(deg(Math.atan2(q[1] - c[1], q[0] - c[0])), d.astep ?? 5);
      if (d.range) {
        // the angle in the range nearest the pointer
        while (a < d.range[0] - 180) a += 360;
        while (a > d.range[1] + 180) a -= 360;
        a = Math.min(d.range[1], Math.max(d.range[0], a));
      }
      this.par[n] = a;
      return;
    }
    const l = this.line(d.on), u = l && unit(...l);
    if (!l || !u) return;
    let t = snapTo((q[0] - l[0][0]) * u[0] + (q[1] - l[0][1]) * u[1], step);
    if (d.clamp) t = Math.max(0, d.clamp === 'segment' ? Math.min(dist(...l), t) : t);
    this.par[n] = t;
  }
  /** One keyboard step: a free point by (dx, dy) steps; a glider forwards (+1) or back (−1). */
  nudge(n: string, dx: number, dy: number, step: number) {
    const d = this.def(n), p = this.pt(n);
    if (!p) return;
    if (this.free[n] || !d.on) return this.moveTo(n, [p[0] + dx * step, p[1] + dy * step], step);
    const k = dx || dy;
    if (isCircle(d.on)) {
      const c = this.circle(d.on), a = rad((this.par[n] as number) + k * (d.astep ?? 5));
      if (c) this.moveTo(n, [c[0] + Math.cos(a), c[1] + Math.sin(a)], step);
    } else {
      const l = this.line(d.on), u = l && unit(...l);
      // forwards = the way the line points to the right (or up, for an upright line)
      const s = u && (u[0] > 1e-9 || (Math.abs(u[0]) <= 1e-9 && u[1] > 0)) ? 1 : -1;
      if (u) this.moveTo(n, [p[0] + s * k * step * u[0], p[1] + s * k * step * u[1]], step);
    }
  }
  /** Lock on (built points follow their definition) or off (they stay where they are, and can be dragged). */
  setLocked(on: boolean) {
    const pts = this.solve();
    this.free = {};
    if (!on) for (const n of this.cfg.lock ?? []) { const p = pts[n]; if (p) this.free[n] = p; }
    this.memo = {};
  }
  get locked() { return !Object.keys(this.free).length; }
  /** The learner's part of the figure, to save and restore (undo, a rejected move). */
  snapshot() { return JSON.stringify([this.par, this.free]); }
  restore(s: string) { [this.par, this.free] = JSON.parse(s); this.memo = {}; }
}

/** The value of a term: a number, "A B" (length), "A B C" (angle at B in degrees); "-…" subtracts. */
export function term(t: string | number, pts: Pts): number | null {
  if (typeof t === 'number') return t;
  const neg = t.trim().startsWith('-'), ns = toks(t.replace(/^\s*-/, '')), ps = ns.map((n) => pts[n] ?? null);
  if (ps.some((p) => !p)) return null;
  const v = ns.length === 3 ? angleAt(ps[0]!, ps[1]!, ps[2]!) : ns.length === 2 ? dist(ps[0]!, ps[1]!) : null;
  return v === null ? null : neg ? -v : v;
}
const isAngle = (t: string | number) => typeof t === 'string' && toks(t.replace(/^\s*-/, '')).length === 3;

/** Decimal places of a readout: `dp`, else 0 for angles (and sums of angles), 1 for lengths, 2 for the rest. */
export const dpOf = (w: WatchDef) =>
  w.dp ?? (w.angle !== undefined ? 0 : w.length !== undefined ? 1 : w.sum ? (w.sum.every((t) => typeof t === 'number' || isAngle(t)) ? 0 : 1) : 2);

/** A watch's reading, rounded as shown (null when a point is missing or a ratio divides by 0). */
export function reading(w: WatchDef, pts: Pts): number | null {
  const all = (ts: (string | number)[], f: (a: number, b: number) => number, z: number) => {
    const vs = ts.map((x) => term(x, pts));
    return vs.some((x) => x === null) ? null : (vs as number[]).reduce(f, z);
  };
  let v: number | null = null;
  if (w.angle !== undefined) v = term(w.angle, pts);
  else if (w.length !== undefined) v = term(w.length, pts);
  else if (w.sum) v = all(w.sum, (a, b) => a + b, 0);
  else if (w.product) v = all(w.product, (a, b) => a * b, 1);
  else if (w.ratio) { const [a, b] = w.ratio.map((x) => term(x, pts)); v = a !== null && b !== null && Math.abs(b) > 1e-9 ? a / b : null; }
  else {
    const f = w.sin !== undefined ? Math.sin : w.cos !== undefined ? Math.cos : Math.tan, a = term((w.sin ?? w.cos ?? w.tan)!, pts);
    v = a === null || (f === Math.tan && Math.abs(a - 90) < 1e-9) ? null : f(rad(a));
  }
  if (v === null || !Number.isFinite(v)) return null;
  const k = 10 ** dpOf(w);
  return Math.round(v * k + 1e-9) / k + 0; // + 0 turns −0 into 0
}
export const readings = (ws: WatchDef[] | undefined, pts: Pts) => Object.fromEntries((ws ?? []).map((w) => [w.key, reading(w, pts)]));
