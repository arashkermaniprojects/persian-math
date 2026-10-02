// The `coord` check: compares a <kg-coord-plane> state with what a mission asks for (docs/STUDIOS.md).
// Pure, so lib/checks.ts can use it. Parts are tested in this order: table → points → line → graph → vectors → pick →
// shift; explicit `traps` are tried first. The vector parts (module `vectors`) live in coord-plane-vec.ts.
import { compile, near, num, onLine, samePt, tidy, valueAt, xIntercept, type Line, type P } from './coord-plane-math';
import { arrowTrap, checkArrows, checkPick, checkShift, vec, type Arrow, type Vec, type VecWant } from './coord-plane-vec';

export interface CoordState {
  /** The learner's points (points mode), in placing order. */
  points?: P[];
  /** The learner's line(s): line mode gives one, from the two handles or the m/c sliders. */
  lines?: (Line & { through?: P[] })[];
  /** The learner's graphs (graph mode): the expression and the parameter values set on the sliders. */
  graphs?: { f: string; params: Record<string, number> }[];
  /** Typed table of values: one entry per given x (y null = not filled in or not a number). */
  table?: { x: number; y: number | null }[];
  /** Units per grid square [x, y], for the `scale` trap. */
  scale?: P;
  /** Module `vectors`: the learner's arrows (tail → head), the choice arrows and which are picked, the image's shift. */
  vectors?: Arrow[];
  choices?: Arrow[];
  picked?: number[];
  shift?: P | null;
}

type Num = number | [number, number];
export interface CoordTrap {
  /** A point the learner placed. */
  point?: P;
  /** A typed table cell [x, y]. */
  cell?: P;
  /** The learner's line has this gradient and/or intercept (or is the vertical line x = `x`). */
  m?: Num;
  c?: Num;
  x?: number;
  /** Module `vectors`: a learner arrow with this vector and/or these ends; the image shifted by this vector. */
  arrow?: VecWant;
  shift?: Vec;
  code: string;
}

export interface CoordCheck {
  type: 'coord';
  /** Every typed y in the table equals f(x) (an expression in x). */
  table?: string;
  /** Exactly these points (any order, ± `tolerance`). */
  points?: P[];
  tolerance?: number;
  /** The learner's line: gradient `m`, intercept `c`, the vertical line x = `x`, through points, parallel/perpendicular to a gradient. */
  line?: { m?: Num; c?: Num; x?: number; through?: P[]; parallelTo?: Num; perpendicularTo?: Num };
  /** The learner's graph equals f (an expression in x) at the sample xs `at` (default −3 … 3). */
  graph?: { f: string; at?: number[] };
  /** Module `vectors`: exactly these arrows, any order (coord-plane-vec.ts). */
  vectors?: VecWant[];
  /** Module `vectors`: the picked choice arrows are exactly those equal (or opposite) to a vector. */
  pick?: { equal?: Vec; opposite?: Vec };
  /** Module `vectors`: the shape's image is the shape moved by this vector. */
  shift?: Vec;
  traps?: CoordTrap[];
}

export interface Result { ok: boolean; code?: string }
const pass: Result = { ok: true };
const fail = (code: string): Result => ({ ok: false, code });

const lineMatches = (l: Line | undefined, t: { m?: Num; c?: Num; x?: number }) =>
  !!l && (t.x === undefined || (l.m === null && near(l.x!, t.x))) &&
  (t.m === undefined || (l.m !== null && near(l.m, num(t.m)))) && (t.c === undefined || (l.c !== null && near(l.c, num(t.c))));

function trapped(check: CoordCheck, s: CoordState): string | undefined {
  const line = s.lines?.[0];
  return check.traps?.find((t) => {
    if (t.point && !(s.points ?? []).some((p) => samePt(p, t.point!, check.tolerance))) return false;
    if (t.cell && !(s.table ?? []).some((r) => near(r.x, t.cell![0]) && r.y !== null && near(r.y, t.cell![1]))) return false;
    if ((t.m !== undefined || t.c !== undefined || t.x !== undefined) && !lineMatches(line, t)) return false;
    if (t.arrow && !arrowTrap(t.arrow, s.vectors)) return false;
    if (t.shift && !(s.shift && samePt(s.shift, vec(t.shift)))) return false;
    return !!(t.point || t.cell || t.m !== undefined || t.c !== undefined || t.x !== undefined || t.arrow || t.shift);
  })?.code;
}

function checkTable(f: string, s: CoordState): Result | null {
  const rows = s.table ?? [];
  if (!rows.some((r) => r.y !== null)) return fail('table-empty');
  if (rows.some((r) => r.y === null)) return fail('table-missing');
  const toks = compile(f);
  return rows.every((r) => near(r.y!, valueAt(toks, r.x))) ? null : fail('table-wrong');
}

function checkPoints(want: P[], s: CoordState, tol = 1e-6): Result | null {
  const got = s.points ?? [];
  if (!got.length) return fail('empty');
  const [sx, sy] = s.scale ?? [1, 1];
  const isWanted = (p: P) => want.some((w) => samePt(p, w, tol));
  const wrong = got.filter((p) => !isWanted(p));
  const missing = want.filter((w) => !got.some((p) => samePt(p, w, tol)));
  if (!wrong.length && !missing.length) return got.length === want.length ? null : fail('too-many');
  // the classic slips, by the point placed: (y, x) for (x, y); squares counted as units on a scaled axis
  if (wrong.some((p) => missing.some((w) => samePt(p, [w[1], w[0]], tol)))) return fail('swapped');
  if ((sx !== 1 || sy !== 1) && wrong.some((p) => missing.some((w) => samePt(p, [w[0] * sx, w[1] * sy], tol)))) return fail('scale');
  if (got.length < want.length && !wrong.length) return fail('too-few');
  if (got.length > want.length) return fail('too-many');
  if (missing.length === 1 && wrong.length === 1) {
    const [p, w] = [wrong[0], missing[0]];
    if (near(p[0], w[0], tol) !== near(p[1], w[1], tol)) return fail('one-coordinate');
  }
  return fail('wrong-point');
}

function checkLine(want: NonNullable<CoordCheck['line']>, s: CoordState): Result | null {
  const l = s.lines?.[0];
  if (!l) return fail('empty');
  const [sx, sy] = s.scale ?? [1, 1];
  if (want.x !== undefined) {
    if (l.m !== null) return fail(near(l.m, 0) && near(l.c!, want.x) ? 'swapped' : 'not-vertical');
    if (!near(l.x!, want.x)) return fail('wrong-line');
  }
  if (want.m !== undefined) {
    const m = num(want.m);
    if (l.m === null) return fail(near(m, 0) && want.c !== undefined && near(l.x!, num(want.c)) ? 'swapped' : 'vertical');
    if (!near(l.m, m)) {
      // the classic slips: run over rise, the sign of a falling line, squares counted on unequal scales
      if (!near(m, 0) && near(l.m, tidy(1 / m))) return fail('run-over-rise');
      if (near(l.m, -m)) return fail('sign');
      if (sx !== sy && near(l.m, tidy((m * sx) / sy))) return fail('scale');
      return fail(near(m, 0) ? 'not-horizontal' : 'wrong-gradient');
    }
  }
  if (want.c !== undefined && l.c !== null && !near(l.c, num(want.c))) {
    // c read off the x-axis: where the wanted line crosses it
    const wl: Line = { m: want.m !== undefined ? num(want.m) : l.m, c: num(want.c) };
    const xi = xIntercept(wl);
    return fail(xi !== null && near(l.c, xi) ? 'intercept-x' : 'wrong-intercept');
  }
  if (want.parallelTo !== undefined && (l.m === null || !near(l.m, num(want.parallelTo)))) return fail('not-parallel');
  if (want.perpendicularTo !== undefined) {
    const k = num(want.perpendicularTo);
    const ok = near(k, 0) ? l.m === null : l.m !== null && near(l.m * k, -1);
    if (!ok) return fail(l.m !== null && near(l.m, -k) ? 'negative-only' : 'not-perpendicular');
  }
  if (want.through && !want.through.every((p) => onLine(l, p))) return fail('not-through');
  return null;
}

function checkGraph(want: NonNullable<CoordCheck['graph']>, s: CoordState): Result | null {
  const g = s.graphs?.[0];
  if (!g) return fail('empty');
  const a = compile(want.f), b = compile(g.f);
  const xs = want.at ?? [-3, -2, -1, 0, 1, 2, 3];
  return xs.every((x) => {
    const u = valueAt(a, x), v = valueAt(b, x, g.params);
    return Number.isNaN(u) ? Number.isNaN(v) : near(u, v);
  }) ? null : fail('wrong-graph');
}

export function checkCoord(check: CoordCheck, state?: { plane?: CoordState }): Result {
  const s = state?.plane ?? {};
  const t = trapped(check, s);
  if (t) return fail(t);
  return (check.table ? checkTable(check.table, s) : null) ??
    (check.points ? checkPoints(check.points, s, check.tolerance) : null) ??
    (check.line ? checkLine(check.line, s) : null) ??
    (check.graph ? checkGraph(check.graph, s) : null) ??
    (check.vectors ? checkArrows(check.vectors, s.vectors ?? []) : null) ??
    (check.pick ? checkPick(check.pick, s.choices ?? [], s.picked ?? []) : null) ??
    (check.shift ? checkShift(check.shift, s.shift) : null) ?? pass;
}
