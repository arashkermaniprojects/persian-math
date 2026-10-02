// The `algebra` check: compares a <kg-algebra-tiles> state with what a mission asks for (docs/STUDIOS.md).
import { add, coef, equal, isCollected, keyOf, kindOrder, kindsOf, mul, parse, poly, powsOf, type Poly } from './algebra-tiles-poly';
import { matPoly, zeroPairs, type Tile } from './algebra-tiles-mat';
import { cellOf, gridTotal, sameSides } from './algebra-tiles-frame';

/** One learner action, in order. `unlike` = a red and a white tile of different shapes put together (refused). */
export interface Move { do: 'add' | 'remove' | 'zero' | 'unlike' | 'sort' | 'clear' | 'flip' | 'side' | 'paint'; tile?: string }

/** What <kg-algebra-tiles> reports, under `state.algebra`. Modules (balance, factors) add their own fields. */
export interface AlgebraState {
  mode: string;
  /** Tiles on the mat, in mat order. */
  mat?: Tile[];
  /** The typed answer in ASCII ("3x^2+2x-3", "-5"); null when nothing is typed. */
  written?: string | null;
  /** Substitution: the tiles show their values. */
  flipped?: boolean;
  moves?: Move[];
  /** rectangle: the two side lengths now (null until both have a piece), the tiles to arrange, and each block's tile. */
  sides?: [string, string] | null;
  given?: string;
  blocks?: { tile: string | null; want: string }[];
  /** grid: headings (left column, top row), cells by row, the product to divide and the typed remainder. */
  rows?: (string | null)[];
  cols?: (string | null)[];
  cells?: (string | null)[][];
  total?: string;
  remainder?: string | null;
}

/**
 * Every field is optional; the check passes when all the given ones hold, tested in this order:
 * expr → simplified (mat) → rectangle → grid → written → simplified (written). The first failure gives the code.
 */
export interface AlgebraCheck {
  type: 'algebra';
  /** The mat equals this expression, compared by coefficients. */
  expr?: string;
  /** No zero pairs left on the mat (with `expr`; code zero-pairs) and no like terms in the written answer (code not-simplified). */
  simplified?: boolean | 'mat' | 'written';
  /** The typed answer equals this expression or number. */
  written?: string;
  /**
   * rectangle: `cells` every block holds the right tile; `sides` the sides are these, in either order;
   * `missing` the tiles that had to be added to the given ones (completing the square).
   */
  rectangle?: { cells?: boolean; sides?: [string, string]; missing?: string };
  /** grid: headings (in order), every cell = its row × column, the remainder of a division. */
  grid?: { rows?: string[]; cols?: string[]; cells?: boolean; remainder?: string };
  /** Known wrong answers with their own code: the mat (`expr`), the typed answer (`write`) or the sides (`sides`). */
  traps?: { expr?: string; write?: string; sides?: [string, string]; code: string }[];
}

type Result = { ok: boolean; code?: string };

const nTerms = (p: Poly) => kindsOf(p).length;
const total = (p: Poly) => Object.values(p).reduce((a, b) => a + b, 0);
/** "x^2" → "x2", "x*y" → "xy": the kind part of codes such as wrong-x2. */
export const codeKey = (k: string) => k.replace(/[\^*]/g, '');

/**
 * Why `got` is not `want`, or null when they are equal. Recognises the classic slips first:
 * x-plus-x-is-x2 (2x written x²), unlike-added (3x + 2 → 5x; 2x² + 3x → 5x³: fewer terms, same coefficient total),
 * sign (every size right, a sign wrong); then too-big/too-small for numbers, else wrong-<kind> for the first kind that differs.
 */
export function diagnose(got: Poly, want: Poly): string | null {
  if (equal(got, want)) return null;
  for (const k of kindsOf(want)) {
    const c = want[k];
    if (k === '1' || !Number.isInteger(c) || Math.abs(c) < 2) continue;
    const p = powsOf(k);
    for (const s in p) p[s] *= Math.abs(c);
    if (equal(got, add(add(want, { [k]: c }, -1), { [keyOf(p)]: Math.sign(c) }))) return 'x-plus-x-is-x2';
  }
  if (nTerms(got) < nTerms(want) && Math.abs(total(got) - total(want)) < 1e-9) return 'unlike-added';
  const ks = [...new Set([...kindsOf(got), ...kindsOf(want)])].sort(kindOrder);
  if (ks.every((k) => Math.abs(coef(got, k)) === Math.abs(coef(want, k)))) return 'sign';
  if (ks.every((k) => k === '1')) return coef(got, '1') > coef(want, '1') ? 'too-big' : 'too-small';
  return `wrong-${codeKey(ks.find((k) => coef(got, k) !== coef(want, k))!)}`;
}

type Part = (c: AlgebraCheck, s: AlgebraState) => string | null;

const trapFor = (c: AlgebraCheck, field: 'expr' | 'write', got: Poly) =>
  c.traps?.find((t) => t[field] !== undefined && equal(got, poly(t[field]!)))?.code ?? null;

const matPart: Part = (c, s) => {
  if (c.expr === undefined) return null;
  const tiles = s.mat ?? [];
  if (!tiles.length) return 'empty';
  const got = matPoly(tiles), want = poly(c.expr);
  if (!equal(got, want)) return trapFor(c, 'expr', got) ?? diagnose(got, want);
  if ((c.simplified === true || c.simplified === 'mat') && zeroPairs(tiles)) return 'zero-pairs';
  return null;
};

const rectPart: Part = (c, s) => {
  const r = c.rectangle;
  if (!r) return null;
  if (r.cells) {
    const b = s.blocks ?? [];
    if (!b.length || b.some((x) => !x.tile)) return 'cells-empty';
    if (b.some((x) => x.tile !== x.want)) return 'wrong-cell';
  }
  if (r.sides || r.missing) {
    const sd = s.sides;
    if (!sd) return 'empty';
    const trap = c.traps?.find((t) => t.sides && sameSides(sd, t.sides));
    if (trap) return trap.code;
    const area = mul(poly(sd[0]), poly(sd[1])), given = s.given ? poly(s.given) : null;
    if (given) {
      const need = r.missing ? add(given, poly(r.missing)) : given;
      if (!equal(area, need)) return 'not-given';
    }
    if (r.sides && !sameSides(sd, r.sides)) return given ? 'partial-factor' : 'wrong-sides';
  }
  return null;
};

const gridPart: Part = (c, s) => {
  const g = c.grid;
  if (!g) return null;
  const rows = s.rows ?? [], cols = s.cols ?? [];
  if (!rows.length || !cols.length || [...rows, ...cols].some((h) => !h || !parse(h))) return 'headers-empty';
  const same = (a: (string | null)[], b: string[]) => a.length === b.length && a.every((h, i) => equal(poly(h!), poly(b[i])));
  if ((g.rows && !same(rows, g.rows)) || (g.cols && !same(cols, g.cols))) return 'wrong-header';
  if (g.cells) {
    const cells = s.cells ?? [];
    for (let i = 0; i < rows.length; i++) for (let j = 0; j < cols.length; j++) {
      const v = cells[i]?.[j], p = v ? parse(v) : null;
      if (!p) return 'cells-empty';
      if (!equal(p, poly(cellOf(rows[i], cols[j])!))) return equal(p, add(poly(rows[i]!), poly(cols[j]!))) ? 'added-not-multiplied' : 'wrong-cell';
    }
  }
  if (s.total) {
    const sum = gridTotal(s.cells ?? []), rem = s.remainder ? parse(s.remainder) : {};
    if (!sum || !rem || !equal(add(sum, rem), poly(s.total))) return g.remainder !== undefined && !s.remainder ? 'remainder-empty' : 'wrong-total';
  }
  if (g.remainder !== undefined && !equal(parse(s.remainder || '0') ?? { x: NaN }, poly(g.remainder))) return 'wrong-remainder';
  return null;
};

const writtenPart: Part = (c, s) => {
  if (c.written === undefined) return null;
  const src = s.written?.trim();
  if (!src) return 'empty';
  const got = parse(src);
  if (!got) return 'syntax';
  const want = poly(c.written);
  if (!equal(got, want)) return trapFor(c, 'write', got) ?? diagnose(got, want);
  if ((c.simplified === true || c.simplified === 'written') && !isCollected(src)) return 'not-simplified';
  return null;
};

/** The parts, in order. A module (balance, factors) adds its own part here, e.g. a `solution` or `factors` check. */
export const PARTS: Part[] = [matPart, rectPart, gridPart, writtenPart];

export function checkAlgebra(c: AlgebraCheck, state?: { algebra?: AlgebraState }): Result {
  const s = state?.algebra;
  if (!s) return { ok: false, code: 'empty' };
  for (const part of PARTS) {
    const code = part(c, s);
    if (code) return { ok: false, code };
  }
  return { ok: true };
}
