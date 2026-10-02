// Rectangle (area model) and grid (box method) for <kg-algebra-tiles>: the sides of a rectangle as groups of equal
// edge pieces, the block of tiles each pair of groups makes, and the cells of a multiplication grid.
import { add, format, kindOrder, mul, mulKey, parse, parseTerms, type Poly } from './algebra-tiles-poly';

/** n equal pieces along a side: x, x, 1, 1, 1 is [{ kind: x, sign: 1, n: 2 }, { kind: 1, sign: 1, n: 3 }]. */
export interface Seg { kind: string; sign: 1 | -1; n: number }

/** A side length as groups of pieces, biggest first: "x - 2" → [x ×1, −1 ×2]. Throws if a coefficient is not whole. */
export function segsOf(src: string): Seg[] {
  const p = parse(src);
  if (!p) throw new Error(`algebra-tiles: cannot read side "${src}"`);
  return Object.keys(p).sort(kindOrder).map((k) => {
    if (!Number.isInteger(p[k])) throw new Error(`algebra-tiles: side "${src}" is not whole pieces`);
    return { kind: k, sign: p[k] > 0 ? 1 : -1, n: Math.abs(p[k]) };
  });
}

export const segsPoly = (s: Seg[]): Poly => s.reduce<Poly>((p, g) => add(p, { [g.kind]: g.sign * g.n }), {});
export const sideText = (s: Seg[]) => format(segsPoly(s));

/** One block of the rectangle: rows group × columns group. `tile` is the signed kind of every tile in it ("x", "-x^2"). */
export interface Block { r: number; c: number; kind: string; sign: 1 | -1; count: number; tile: string }

export const tileKey = (kind: string, sign: number) => (sign < 0 ? '-' : '') + kind;

export function blocksOf(rows: Seg[], cols: Seg[]): Block[] {
  return rows.flatMap((a, r) => cols.map((b, c) => {
    const kind = mulKey(a.kind, b.kind), sign = (a.sign * b.sign) as 1 | -1;
    return { r, c, kind, sign, count: a.n * b.n, tile: tileKey(kind, sign) };
  }));
}

/** The area: the product of the two sides. */
export const areaOf = (rows: Seg[], cols: Seg[]) => mul(segsPoly(rows), segsPoly(cols));

/** The two sides match, in either order. */
export function sameSides(a: [string, string], b: [string, string]): boolean {
  const [p, q, r, s] = [...a, ...b].map((x) => parse(x));
  if (!p || !q || !r || !s) return false;
  const eq = (u: Poly, v: Poly) => format(u) === format(v);
  return (eq(p, r) && eq(q, s)) || (eq(p, s) && eq(q, r));
}

/** Grid (box method) cell = row term × column term, ASCII; null when a heading is still empty or unreadable. */
export function cellOf(row: string | null, col: string | null): string | null {
  const a = row && parse(row), b = col && parse(col);
  return a && b ? format(mul(a, b)) : null;
}

/** The sum of the cells of a grid (what the grid multiplies out to); null when a cell is empty or unreadable. */
export function gridTotal(cells: (string | null)[][]): Poly | null {
  let t: Poly = {};
  for (const row of cells) for (const c of row) {
    const p = c ? parse(c) : null;
    if (!p) return null;
    t = add(t, p);
  }
  return t;
}

/** The terms of an expression, one per heading: "x + 3" → ["x", "3"]. */
export const headingsOf = (src: string) => (parseTerms(src) ?? []).map(format);
