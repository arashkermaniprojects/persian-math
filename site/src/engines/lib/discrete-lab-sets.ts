// Pure set maths for <kg-discrete-lab> (docs/STUDIOS.md "Engine options → discrete-lab"): Venn layouts and their
// regions, card slots inside each region, set expressions (A ∪ B, A ∩ B, A − B, A′), set literals ({1, 2}, ∅),
// relations (∈, ⊆, =) and two-way table totals. No DOM, so the tests and lib/checks.ts can use it.

/** A region of a Venn diagram: the names of the sets it is inside, in the order the sets are given ("A", "AB"), or "out". */
export type Region = string;
export const OUT = 'out';

export interface Circle { x: number; y: number; r: number }
export type LayoutKind = 'overlap' | 'apart' | 'nest';
export interface Layout {
  kind: LayoutKind;
  sets: string[];
  /** For `nest`: [inner, outer]. */
  nest?: [string, string];
  circles: Record<string, Circle>;
  /** The universal rectangle is 0..w × 0..h (SVG units; the diagram always runs left to right). */
  w: number;
  h: number;
  regions: Region[];
}

const W = 360, H = 340;

/** Key of the region inside exactly the sets `inside` (set names are single letters, as in the books: A, B, C). */
export function regionKey(sets: string[], inside: string[]): Region {
  return sets.filter((s) => inside.includes(s)).join('') || OUT;
}
export const inRegion = (r: Region, s: string) => r !== OUT && r.includes(s);
export const setsOf = (r: Region) => (r === OUT ? [] : [...r]);

/**
 * `layout`: "overlap" (default), "apart" (two sets that share nothing) or "X⊆Y" (X drawn inside Y). One set is a
 * single oval, three sets overlap in a triangle.
 */
export function makeLayout(sets: string[], layout = 'overlap'): Layout {
  const m = /^(\w)\s*⊆\s*(\w)$/.exec(layout);
  const circles: Record<string, Circle> = {};
  let kind: LayoutKind = 'overlap', nest: [string, string] | undefined;
  if (sets.length === 1) circles[sets[0]] = { x: 180, y: 145, r: 112 };
  else if (sets.length === 2 && m && sets.includes(m[1]) && sets.includes(m[2]) && m[1] !== m[2]) {
    kind = 'nest';
    nest = [m[1], m[2]];
    circles[m[2]] = { x: 175, y: 150, r: 135 };
    circles[m[1]] = { x: 225, y: 165, r: 65 };
  } else if (sets.length === 2 && layout === 'apart') {
    kind = 'apart';
    circles[sets[0]] = { x: 92, y: 150, r: 86 };
    circles[sets[1]] = { x: 268, y: 150, r: 86 };
  } else if (sets.length === 2) {
    circles[sets[0]] = { x: 128, y: 150, r: 118 };
    circles[sets[1]] = { x: 232, y: 150, r: 118 };
  } else {
    [[180, 112], [122, 205], [238, 205]].forEach(([x, y], i) => sets[i] && (circles[sets[i]] = { x, y, r: 102 }));
  }
  const L: Layout = { kind, sets, nest, circles, w: W, h: H, regions: [] };
  // Every region that exists in this drawing, in a fixed order: one set, two sets, …, then outside.
  const all: Region[] = [];
  for (let mask = 1; mask < 1 << sets.length; mask++) all.push(regionKey(sets, sets.filter((_, i) => mask & (1 << i))));
  all.sort((a, b) => a.length - b.length);
  L.regions = [...all.filter((r) => kind === 'overlap' || (kind === 'apart' ? r.length === 1 : r !== nest![0])), OUT];
  return L;
}

/** The region at a point of the diagram, or null outside the universal rectangle. */
export function regionAt(L: Layout, x: number, y: number): Region | null {
  if (x < 0 || y < 0 || x > L.w || y > L.h) return null;
  return regionKey(L.sets, L.sets.filter((s) => {
    const c = L.circles[s];
    return Math.hypot(x - c.x, y - c.y) <= c.r;
  }));
}

/** Where each set's name is written: just outside its oval, away from the middle of the drawing (inside U). */
export function labelAt(L: Layout): Record<string, [number, number]> {
  const cs = L.sets.map((s) => L.circles[s]);
  const mx = cs.reduce((a, c) => a + c.x, 0) / cs.length, my = cs.reduce((a, c) => a + c.y, 0) / cs.length;
  const clamp = (v: number, hi: number) => Math.max(16, Math.min(hi - 16, v));
  return Object.fromEntries(L.sets.map((s) => {
    const c = L.circles[s];
    let dx = c.x - mx, dy = c.y - my;
    if (L.nest?.[0] === s) [dx, dy] = [c.x - L.circles[L.nest[1]].x, c.y - L.circles[L.nest[1]].y];
    const n = Math.hypot(dx, dy);
    if (n < 1) [dx, dy] = [-0.6, -0.8];
    else [dx, dy] = [dx / n, dy / n];
    // Up and to the side reads better than straight sideways.
    const ux = dx * 0.7, uy = Math.min(dy, 0) * 0.3 - 0.7, un = Math.hypot(ux, uy);
    return [s, [clamp(c.x + (ux / un) * (c.r + 12), L.w), clamp(c.y + (uy / un) * (c.r + 12), L.h)]];
  }));
}

/** The name of the universal set sits in the top corner. */
export const UNIVERSE_AT: [number, number] = [18, 22];

/**
 * Where cards sit in each region: points at least `gap` apart and at least `margin` from every outline, nearest the
 * middle of the region first. Cards are ~44px, so with the diagram about 340px wide a gap of 50 keeps them apart.
 */
export function slots(L: Layout, gap = 50, margin = 27): Record<Region, [number, number][]> {
  const pts: Record<Region, [number, number][]> = {};
  for (const r of L.regions) pts[r] = [];
  const names = [...Object.values(labelAt(L)), UNIVERSE_AT];
  for (let y = margin; y <= L.h - margin; y += 6)
    for (let x = margin; x <= L.w - margin; x += 6) {
      const near = L.sets.some((s) => {
        const c = L.circles[s];
        return Math.abs(Math.hypot(x - c.x, y - c.y) - c.r) < margin;
      });
      const r = regionAt(L, x, y);
      if (!near && r && pts[r] && names.every(([a, b]) => Math.hypot(x - a, y - b) > 36)) pts[r].push([x, y]);
    }
  const out: Record<Region, [number, number][]> = {};
  for (const r of L.regions) {
    const p = pts[r];
    // Middle of the region: its circles' centres (or, outside, the bottom strip under the ovals).
    const cs = setsOf(r).map((s) => L.circles[s]);
    const mid: [number, number] = cs.length
      ? [cs.reduce((a, c) => a + c.x, 0) / cs.length, cs.reduce((a, c) => a + c.y, 0) / cs.length]
      : [L.w / 2, L.h];
    // A crescent ("only A") has its middle off-centre: pull towards the side away from the other sets.
    if (cs.length && L.kind !== 'apart')
      for (const s of L.sets.filter((s) => !r.includes(s))) {
        const o = L.circles[s];
        mid[0] += (mid[0] - o.x) * 0.6;
        mid[1] += (mid[1] - o.y) * 0.6;
      }
    p.sort((a, b) => Math.hypot(a[0] - mid[0], a[1] - mid[1]) - Math.hypot(b[0] - mid[0], b[1] - mid[1]));
    const pick: [number, number][] = [];
    for (const q of p) if (pick.every((s) => Math.max(Math.abs(s[0] - q[0]), Math.abs(s[1] - q[1])) >= gap)) pick.push(q); // cards are squares
    out[r] = pick;
  }
  return out;
}

// ---------- set expressions ----------

interface Algebra<T> { all: T; none: T; name(s: string): T; union(a: T, b: T): T; inter(a: T, b: T): T; diff(a: T, b: T): T; comp(a: T): T }

/**
 * Evaluate a set expression: names (A, B, C), U (the universal set), ∅, ∪, ∩, − (or -), ′ (or ') for the complement,
 * and brackets. ∩ binds tighter than ∪ and −, which go left to right; ′ binds tightest.
 */
export function evaluate<T>(expr: string, alg: Algebra<T>): T {
  const t = expr.replace(/\s+/g, '').replace(/-/g, '−').replace(/'/g, '′').replace(/ᶜ/g, '′');
  let i = 0;
  const fail = () => { throw new Error(`Bad set expression "${expr}" at ${i}`); };
  const atom = (): T => {
    const c = t[i];
    let v: T;
    if (c === '(') {
      i++;
      v = sum();
      if (t[i++] !== ')') fail();
    } else if (c === 'U') (i++, v = alg.all);
    else if (c === '∅') (i++, v = alg.none);
    else if (c && /\w/.test(c)) (i++, v = alg.name(c));
    else return fail();
    while (t[i] === '′') (i++, v = alg.comp(v));
    return v;
  };
  const product = (): T => {
    let v = atom();
    while (t[i] === '∩') (i++, v = alg.inter(v, atom()));
    return v;
  };
  const sum = (): T => {
    let v = product();
    while (t[i] === '∪' || t[i] === '−') v = t[i++] === '∪' ? alg.union(v, product()) : alg.diff(v, product());
    return v;
  };
  const v = sum();
  if (i !== t.length) fail();
  return v;
}

/** The regions an expression covers in a layout (e.g. "A − B" → ["A"] for two overlapping sets). */
export function exprRegions(expr: string, L: Pick<Layout, 'regions'>): Region[] {
  const rs = L.regions;
  return evaluate<Region[]>(expr, {
    all: rs, none: [], name: (s) => rs.filter((r) => inRegion(r, s)),
    union: (a, b) => rs.filter((r) => a.includes(r) || b.includes(r)),
    inter: (a, b) => a.filter((r) => b.includes(r)),
    diff: (a, b) => a.filter((r) => !b.includes(r)),
    comp: (a) => rs.filter((r) => !a.includes(r)),
  });
}

/** The elements of an expression, given each set's elements and the universal set (in the universal set's order). */
export function exprElements(expr: string, defs: Record<string, string[]>, universe: string[]): string[] {
  const all = uniq([...universe, ...Object.values(defs).flat()]);
  const keep = (ok: (x: string) => boolean) => all.filter(ok);
  return evaluate<string[]>(expr, {
    all, none: [], name: (s) => keep((x) => (defs[s] ?? []).includes(x)),
    union: (a, b) => keep((x) => a.includes(x) || b.includes(x)),
    inter: (a, b) => a.filter((x) => b.includes(x)),
    diff: (a, b) => a.filter((x) => !b.includes(x)),
    comp: (a) => keep((x) => !a.includes(x)),
  });
}

// ---------- elements, literals and relations ----------

export const uniq = <T>(a: T[]) => [...new Set(a)];
/** Same elements, whatever the order or repeats ({1, 2} = {2, 1, 1}). */
export const sameSet = (a: string[], b: string[]) => {
  const x = uniq(a), y = uniq(b);
  return x.length === y.length && x.every((v) => y.includes(v));
};
/** The elements written more than once. */
export const repeats = (a: string[]) => uniq(a.filter((v, i) => a.indexOf(v) !== i));

/** Elements of a set from where its cards are: every card in a region inside the set. */
export function membersFrom(place: Record<string, Region | null>, sets: string[]): Record<string, string[]> {
  return Object.fromEntries(sets.map((s) => [s, Object.keys(place).filter((k) => place[k] && inRegion(place[k]!, s))]));
}

export type Operand = { kind: 'element'; value: string } | { kind: 'set'; elems: string[] };

/** "4" → an element; "{4}", "{2, 4}", "{}", "∅" → a set; a defined name ("A") → that set. Digits in any script. */
export function parseOperand(s: string, defs: Record<string, string[]> = {}): Operand {
  const t = toAscii(s.trim());
  if (t === '∅' || /^\{\s*\}$/.test(t)) return { kind: 'set', elems: [] };
  const m = /^\{(.*)\}$/.exec(t);
  if (m) return { kind: 'set', elems: m[1].split(/[,،]/).map((x) => x.trim()).filter(Boolean) };
  if (defs[t]) return { kind: 'set', elems: defs[t] };
  return { kind: 'element', value: t };
}

export const SYMBOLS = ['∈', '∉', '⊆', '⊄', '=', '≠'] as const;

/** Whether "left sym right" is true. ∈/∉ ask for an element on the left, ⊆/⊄ for a set; = and ≠ compare like with like. */
export function relationHolds(left: Operand, sym: string, right: Operand): boolean {
  const R = right.kind === 'set' ? right.elems : null;
  switch (sym) {
    case '∈': return left.kind === 'element' && !!R && R.includes(left.value);
    case '∉': return !!R && !(left.kind === 'element' && R.includes(left.value));
    case '⊆': return left.kind === 'set' && !!R && left.elems.every((x) => R.includes(x));
    case '⊄': return left.kind === 'set' && !!R && !left.elems.every((x) => R.includes(x));
    case '=': case '≠': {
      const eq = left.kind === 'set' && right.kind === 'set' ? sameSet(left.elems, right.elems)
        : left.kind === 'element' && right.kind === 'element' && left.value === right.value;
      return sym === '=' ? eq : !eq;
    }
  }
  return false;
}

/** ∈/∉ are about one element; ⊆/⊄ about a whole set. */
export const symbolFamily = (sym: string) => (sym === '∈' || sym === '∉' ? 'element' : sym === '⊆' || sym === '⊄' ? 'set' : 'equal');

export const toAscii = (s: string) => s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));

// ---------- two-way tables ----------

export interface Totals { rows: number[]; cols: number[]; all: number }
export function tableTotals(v: number[][]): Totals {
  const rows = v.map((r) => r.reduce((a, b) => a + b, 0));
  const cols = (v[0] ?? []).map((_, j) => v.reduce((a, r) => a + (r[j] ?? 0), 0));
  return { rows, cols, all: rows.reduce((a, b) => a + b, 0) };
}

/** The value of a table key: "r,c" a cell, "r,t" a row total, "t,c" a column total, "t,t" the grand total (0-based). */
export function tableValue(v: number[][], key: string): number {
  const [r, c] = key.split(',');
  const T = tableTotals(v);
  if (r === 't' && c === 't') return T.all;
  if (r === 't') return T.cols[+c];
  if (c === 't') return T.rows[+r];
  return v[+r][+c];
}

/**
 * The same data as a Venn diagram of two sets A, B and a two-way table: rows A, A′ and columns B, B′.
 * [[A∩B, A only], [B only, outside]].
 */
export function countsToTable(counts: Record<Region, number | null>, sets: [string, string]): (number | null)[][] {
  const [a, b] = sets, k = (i: string[]) => counts[regionKey(sets, i)] ?? null;
  return [[k([a, b]), k([a])], [k([b]), k([])]];
}
