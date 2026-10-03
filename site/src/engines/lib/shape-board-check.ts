// The `shape-board` check: compares a <kg-shape-board> state with what a mission asks for (docs/STUDIOS.md).
// Pure, so lib/checks.ts can use it.
import {
  angleAt, angleKind, area, classify, clean, covers, cubeNet, edges, inside, mapSegs, near, onLine, parallel, perimeter,
  perpendicular, reflect, rotate, samePt, sameDrawing, scale, similarity, symmetricIn, translate, type P, type Seg,
} from './shape-board-geom';

export type DrawnKind = 'polygon' | 'path' | 'segment' | 'line' | 'ray';
export interface Drawn { kind: DrawnKind; pts: P[]; closed?: boolean }
export interface ShapeBoardState {
  /** What the learner drew, in drawing order. */
  drawn?: Drawn[];
  /** Points placed in `points` mode. */
  points?: P[];
  /** Indices of the given shapes (or solids) the learner tapped in `select` mode. */
  selected?: number[];
  /** Shaded unit cells, by their lower-left corner. */
  cells?: P[];
  /** Pieces in `move` mode: offset moved, total turn in degrees (anticlockwise +), corners now. */
  pieces?: { at: P; turn: number; pts: P[] }[];
  /** Compass circles [cx, cy, r]. */
  circles?: [number, number, number][];
  /** The given shapes, in setup order (for symmetry and image checks); circles have no points. */
  given?: Drawn[];
  /** Number tile tapped. */
  picked?: number | null;
  /** 3D cube builder: total cubes, height per plan square, and [length, width, height] when it is one full cuboid. */
  cubes?: { count: number; heights: number[][]; box: [number, number, number] | null };
  /**
   * Dynamic figure (module shape-board/dynamic.ts): named points, live readouts by watch key (rounded as shown),
   * positions explored by dragging, the "what stayed the same?" choice, and whether built points are locked.
   */
  dyn?: { pts: Record<string, P | null>; values: Record<string, number | null>; dragged: number; chosen: string | null; locked: boolean };
}

type LineRef = number | Seg;
/**
 * Every field is optional; the check passes when all the given ones hold. Tested in this order (the first failure
 * gives the code): drawing (open/crossed, `sides`, `shape`/`not`, `area`, `perimeter`, `lengths`) → `count` → `image`
 * → `similar` → `line` → `chord` → `angle` → `points` → `selected` → `cells`/`within`/`net` → `fits` → `piece` → `cubes`/`box` → `pick`
 * → `dragged` → `invariant` → `watch` (dynamic figures).
 */
export interface ShapeBoardCheck {
  type: 'shape-board';
  /** Every closed shape drawn has all these classes (classify(): triangle, square, isosceles, right-angled, regular…). */
  shape?: string | string[];
  /** …and none of these (e.g. a rectangle that is not a square). */
  not?: string[];
  sides?: number;
  area?: number;
  perimeter?: number;
  /** Side lengths in any order (constructions), ± 0.05. */
  lengths?: number[];
  /** Number of shapes drawn (closed ones when `shape`/`not` is given). */
  count?: number;
  /** The drawing is exactly the image of given shape `of` (default 0) under one move. */
  image?: { of?: number; translate?: P; reflect?: Seg; rotate?: { about: P; angle: number }; scale?: { about: P; factor: number } };
  /** The last closed shape drawn is similar to given shape `of`, optionally with this scale factor. */
  similar?: { of?: number; factor?: number };
  /** The last line/segment/ray drawn: a fold line of a given shape, parallel/perpendicular to a given segment (index) or [[x,y],[x,y]], through points. */
  line?: { symmetryOf?: number; parallel?: LineRef; perpendicular?: LineRef; through?: P[] };
  /**
   * The last segment drawn is a chord of a compass circle (both ends on it). `diameter: true` = it must go through
   * the centre, `false` = it must not.
   */
  chord?: true | { diameter?: boolean };
  /** The angle drawn as a path arm–corner–arm: a kind (acute, right, obtuse, straight) or degrees (± 0.5). */
  angle?: string | number;
  /** Exactly these points placed (any order). */
  points?: P[];
  /** Exactly these given shapes (or solids) tapped. */
  selected?: number[];
  /** Number of shaded cells. */
  cells?: number;
  /** Shaded cells must lie inside given shape n. */
  within?: number;
  /** Shaded cells fold into a cube. */
  net?: 'cube';
  /** The pieces exactly cover given shape n (cut and rearrange). */
  fits?: number;
  /** Piece 0 (or `index`) moved by `at` and/or turned by `turn` degrees (anticlockwise +, so −90 = a quarter turn clockwise). */
  piece?: { index?: number; at?: P; turn?: number };
  /** Cubes in the 3D builder. */
  cubes?: number;
  /** The cubes form one full cuboid with these sides (any order). */
  box?: [number, number, number];
  pick?: number;
  /** Dynamic figure: the learner dragged it into at least n different positions before answering. */
  dragged?: number;
  /** Dynamic figure: the "what stayed the same?" choice (a key of the setup's `ask`). */
  invariant?: string;
  /**
   * Dynamic figure: readout `key` now `equals` a number (drag until…), and/or the typed answer (`answer: integer` or
   * `decimal`) equals the readout (`typed: true`; the readout may be hidden, so the learner predicts it). ± `tolerance`.
   */
  watch?: { key: string; equals?: number; typed?: boolean; tolerance?: number };
  /**
   * Known wrong answers with their own code: a shape class drawn, a shape tapped, a number picked, a point placed;
   * dynamic figures: a choice (`chosen`), a typed number (`typed`), or a typed number equal to another readout (`watch`).
   */
  traps?: { shape?: string; select?: number; pick?: number; point?: P; chosen?: string; typed?: number; watch?: string; code: string }[];
}

type Result = { ok: true } | { ok: false; code: string };
const fail = (code: string): Result => ({ ok: false, code });
const more = (got: number, want: number) => (got > want ? 'too-many' : 'too-few');
const size = (got: number, want: number, base: string) => `${base}-too-${got > want ? 'big' : 'small'}`;
const setEq = (a: P[], b: P[]) => a.length === b.length && b.every((q) => a.some((p) => samePt(p, q)));
/** Sides implied by a class name. */
const SIDES: Record<string, number> = { quadrilateral: 4, square: 4, rectangle: 4, rhombus: 4, parallelogram: 4, trapezium: 4, kite: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8 };
for (const t of ['triangle', 'equilateral', 'isosceles', 'scalene', 'right-angled', 'acute-angled', 'obtuse-angled']) SIDES[t] = 3;

/** The segments a drawing is made of (lines and rays count as the part between their two points). */
const segsOf = (d: Drawn[]): Seg[] => d.flatMap((s) => edges(s.pts, s.kind === 'polygon' && s.closed !== false));
const lineOf = (ref: LineRef, given: Drawn[]): Seg => (typeof ref === 'number' ? [given[ref].pts[0], given[ref].pts[1]] : ref);

export function checkShapeBoard(c: ShapeBoardCheck, s: ShapeBoardState | undefined, typed: number | null = null): Result {
  const drawn = (s?.drawn ?? []).filter((d) => d.pts.length > 1 || d.kind === 'polygon');
  const given = s?.given ?? [];
  const polys = drawn.filter((d) => d.kind === 'polygon' && d.pts.length);
  const want = [c.shape ?? []].flat();
  const trap = (f: (t: NonNullable<ShapeBoardCheck['traps']>[number]) => boolean) => c.traps?.find(f)?.code;

  if (want.length || c.not || c.sides || c.area !== undefined || c.perimeter !== undefined || c.lengths) {
    if (!polys.length) return fail('empty');
    for (const d of polys) {
      const k = classify(d.pts);
      if (!d.closed || k[0] === 'open') return fail('open');
      if (k[0] === 'crossed') return fail('crossed');
      const n = clean(d.pts).length;
      const ok = want.every((w) => k.includes(w)) && !(c.not ?? []).some((w) => k.includes(w));
      const t = ok ? undefined : trap((x) => !!x.shape && k.includes(x.shape));
      if (t) return fail(t);
      const sides = c.sides ?? want.map((w) => SIDES[w]).find(Boolean);
      if (sides && n !== sides) return fail(n > sides ? 'too-many-sides' : 'too-few-sides');
      for (const w of want) if (!k.includes(w)) return fail(`not-${w}`);
      for (const w of c.not ?? []) if (k.includes(w)) return fail(`is-${w}`);
      if (c.area !== undefined && !near(area(d.pts), c.area)) return fail(size(area(d.pts), c.area, 'area'));
      if (c.perimeter !== undefined && !near(perimeter(d.pts), c.perimeter)) return fail(size(perimeter(d.pts), c.perimeter, 'perimeter'));
      if (c.lengths) {
        const got = edges(clean(d.pts)).map(([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1])).sort((x, y) => x - y);
        const w2 = [...c.lengths].sort((x, y) => x - y);
        if (got.length !== w2.length || got.some((g, i) => !near(g, w2[i], 0.05))) return fail('wrong-lengths');
      }
    }
  }
  if (c.count !== undefined) {
    const n = want.length || c.not ? polys.filter((d) => d.closed).length : drawn.length;
    if (n !== c.count) return fail(n ? more(n, c.count) : 'empty');
  }
  if (c.image) {
    const g = given[c.image.of ?? 0], src = g?.pts ?? [], gs = g ? segsOf([g]) : [];
    const { translate: tr, reflect: rf, rotate: ro, scale: sc } = c.image;
    const f = (p: P): P => (tr ? translate(p, tr) : rf ? reflect(p, rf) : ro ? rotate(p, ro.about, ro.angle) : sc ? scale(p, sc.about, sc.factor) : p);
    const mine = segsOf(drawn);
    if (!mine.length) return fail('empty');
    if (!sameDrawing(mine, mapSegs(gs, f))) {
      // common slips: copied (slid) instead of mirrored; turned the wrong way; x and y moves swapped
      if (rf) {
        const low = (pts: P[]) => pts.reduce((m, p) => (p[0] < m[0] - 1e-9 || (near(p[0], m[0]) && p[1] < m[1]) ? p : m));
        const a = low(src), b = low(mine.flat());
        if (sameDrawing(mine, mapSegs(gs, (p) => translate(p, [b[0] - a[0], b[1] - a[1]])))) return fail('slid');
      }
      if (ro && sameDrawing(mine, mapSegs(gs, (p) => rotate(p, ro.about, -ro.angle)))) return fail('wrong-way');
      if (tr && sameDrawing(mine, mapSegs(gs, (p) => translate(p, [tr[1], tr[0]])))) return fail('swapped');
      return fail('not-image');
    }
  }
  if (c.similar) {
    const k = similarity(given[c.similar.of ?? 0]?.pts ?? [], polys[polys.length - 1]?.pts ?? []);
    if (k === null) return fail('not-similar');
    if (c.similar.factor !== undefined && !near(k, c.similar.factor)) return fail('wrong-factor');
  }
  if (c.line) {
    const l = [...drawn].reverse().find((d) => d.kind !== 'polygon' && d.pts.length === 2);
    if (!l) return fail('empty');
    const seg = l.pts as Seg, { symmetryOf: sym, parallel: par, perpendicular: per, through } = c.line;
    const g = sym === undefined ? undefined : given[sym];
    if (g && !symmetricIn(segsOf([g]), seg)) return fail(g.pts.filter((p) => onLine(p, seg)).length >= 2 ? 'diagonal' : 'not-symmetry');
    if (par !== undefined && !parallel(seg, lineOf(par, given))) return fail('not-parallel');
    if (per !== undefined && !perpendicular(seg, lineOf(per, given))) return fail('not-perpendicular');
    if (through && !through.every((p) => onLine(p, seg))) return fail('not-through');
  }
  if (c.chord) {
    const circles = s?.circles ?? [];
    if (!circles.length) return fail('no-circle');
    const l = [...drawn].reverse().find((d) => d.kind === 'segment' && d.pts.length === 2);
    if (!l) return fail('empty');
    const on = (p: P, [x, y, r]: [number, number, number]) => near(Math.hypot(p[0] - x, p[1] - y), r, 1e-6 * Math.max(1, r));
    const circle = circles.find((k) => l.pts.every((p) => on(p, k)));
    if (!circle) return fail('not-chord');
    const want = c.chord === true ? undefined : c.chord.diameter, centre = onLine([circle[0], circle[1]], l.pts as Seg);
    if (want === false && centre) return fail('is-diameter');
    if (want === true && !centre) return fail('not-diameter');
  }
  if (c.angle !== undefined) {
    const a = [...drawn].reverse().find((d) => d.kind === 'path' && d.pts.length === 3);
    if (!a) return fail('empty');
    const deg = angleAt(a.pts[0], a.pts[1], a.pts[2]);
    if (typeof c.angle === 'number') { if (!near(deg, c.angle, 0.5)) return fail(size(deg, c.angle, 'angle')); }
    else if (angleKind(deg) !== c.angle) return fail(`is-${angleKind(deg)}`);
  }
  if (c.points) {
    const got = s?.points ?? [];
    if (!got.length) return fail('empty');
    if (!setEq(got, c.points)) {
      const t = trap((x) => !!x.point && got.some((p) => samePt(p, x.point!)));
      if (t) return fail(t);
      if (setEq(got, c.points.map(([x, y]): P => [y, x]))) return fail('swapped');
      return fail(got.length !== c.points.length ? more(got.length, c.points.length) : 'wrong-point');
    }
  }
  if (c.selected) {
    const got = s?.selected ?? [];
    if (!got.length) return fail('empty');
    const extra = got.filter((i) => !c.selected!.includes(i));
    const t = trap((x) => x.select !== undefined && extra.includes(x.select));
    if (t) return fail(t);
    if (extra.length) return fail('extra');
    if (c.selected.some((i) => !got.includes(i))) return fail('missed');
  }
  if (c.cells !== undefined || c.net || c.within !== undefined) {
    const cells = s?.cells ?? [];
    if (!cells.length) return fail('empty');
    if (c.within !== undefined && cells.some(([x, y]) => !inside([x + 0.5, y + 0.5], given[c.within!]?.pts ?? []))) return fail('outside');
    if (c.cells !== undefined && cells.length !== c.cells) return fail(more(cells.length, c.cells));
    if (c.net === 'cube' && !cubeNet(cells)) return fail(cells.length === 6 ? 'not-net' : more(cells.length, 6));
  }
  const pieces = s?.pieces ?? [];
  if (c.fits !== undefined && !covers(pieces.map((p) => p.pts), given[c.fits]?.pts ?? [])) return fail('not-fit');
  if (c.piece) {
    const p = pieces[c.piece.index ?? 0];
    if (!p) return fail('empty');
    if (c.piece.turn !== undefined && p.turn !== c.piece.turn) {
      const norm = (t: number) => ((t % 360) + 360) % 360;
      if (norm(p.turn) === norm(c.piece.turn)) return fail('long-way');
      return fail(norm(p.turn) === norm(-c.piece.turn) ? 'wrong-way' : 'wrong-turn');
    }
    if (c.piece.at && !samePt(p.at, c.piece.at)) return fail(samePt(p.at, [c.piece.at[1], c.piece.at[0]]) ? 'swapped' : 'wrong-place');
  }
  if (c.cubes !== undefined || c.box) {
    const q = s?.cubes;
    if (!q?.count) return fail('empty');
    if (c.cubes !== undefined && q.count !== c.cubes) return fail(more(q.count, c.cubes));
    if (c.box) {
      if (!q.box) return fail('not-box');
      const [a, b] = [[...q.box], [...c.box]].map((v) => v.sort((x, y) => x - y).join());
      if (a !== b) return fail('wrong-box');
    }
  }
  if (c.pick !== undefined) {
    const p = s?.picked;
    if (p == null) return fail('empty');
    if (p !== c.pick) return fail(trap((x) => x.pick === p) ?? (p > c.pick ? 'too-big' : 'too-small'));
  }
  if (c.dragged !== undefined || c.invariant !== undefined || c.watch) return checkDynamic(c, s?.dyn, typed);
  return { ok: true };
}

/**
 * The dynamic-figure parts, `dragged` → `invariant` → `watch`. Codes: `not-dragged`, `empty` (nothing chosen or
 * typed), `wrong-invariant`, `no-reading` (the figure cannot be measured), `watch-too-big`/`-small`, `too-big`/`too-small`.
 */
function checkDynamic(c: ShapeBoardCheck, d: ShapeBoardState['dyn'], typed: number | null): Result {
  if (!d) return fail('empty');
  const trap = (f: (t: NonNullable<ShapeBoardCheck['traps']>[number]) => boolean) => c.traps?.find(f)?.code;
  if (c.dragged !== undefined && d.dragged < c.dragged) return fail('not-dragged');
  if (c.invariant !== undefined && d.chosen !== c.invariant) return fail(d.chosen == null ? 'empty' : trap((t) => t.chosen === d.chosen) ?? 'wrong-invariant');
  const w = c.watch;
  if (!w) return { ok: true };
  const v = d.values[w.key], tol = w.tolerance ?? 1e-6;
  if (v == null) return fail('no-reading');
  if (w.equals !== undefined && !near(v, w.equals, tol)) return fail(size(v, w.equals, 'watch'));
  if (w.typed) {
    if (typed == null) return fail('empty');
    if (!near(typed, v, tol)) {
      const other = (k: string) => d.values[k] ?? NaN;
      const t = trap((x) => (x.typed !== undefined && near(typed, x.typed, tol)) || (x.watch !== undefined && near(typed, other(x.watch), tol)));
      return fail(t ?? (typed > v ? 'too-big' : 'too-small'));
    }
  }
  return { ok: true };
}
