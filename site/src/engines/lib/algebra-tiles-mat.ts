// The tile mat of <kg-algebra-tiles>: tiles are monomials of degree 0–2 (1, x, x², y, xy, y², a labelled √3 …), each
// white (+) or red (−, the flip side). A red and a white tile of the SAME shape make a zero pair.
import { add, degreeOf, evaluate, kindOrder, parseTerms, powsOf, type Poly } from './algebra-tiles-poly';

export interface Tile { kind: string; sign: 1 | -1 }

/** A kind can be a tile when its degree is at most 2 (x², xy, y² are the biggest tiles). */
export const isTileKind = (k: string) => degreeOf(k) <= 2;

/**
 * Tiles for an expression in the order it is written, NOT combined: "2x + 3 - x" → x, x, 1, 1, 1, −x.
 * Throws when a term is not a whole number of tiles (e.g. 2.5x or x³).
 */
export function tilesOf(src: string): Tile[] {
  const terms = parseTerms(src);
  if (!terms) throw new Error(`algebra-tiles: cannot read "${src}"`);
  const out: Tile[] = [];
  for (const t of terms) for (const k of Object.keys(t).sort(kindOrder)) {
    const c = t[k];
    if (!Number.isInteger(c) || !isTileKind(k)) throw new Error(`algebra-tiles: "${src}" is not made of whole tiles`);
    for (let i = 0; i < Math.abs(c); i++) out.push({ kind: k, sign: c > 0 ? 1 : -1 });
  }
  return out;
}

/** The expression the mat shows. */
export const matPoly = (tiles: Tile[]): Poly => tiles.reduce<Poly>((p, t) => add(p, { [t.kind]: t.sign }), {});

/** How many zero pairs could still be taken off. */
export function zeroPairs(tiles: Tile[]): number {
  const n: Record<string, [number, number]> = {};
  for (const t of tiles) (n[t.kind] ??= [0, 0])[t.sign > 0 ? 0 : 1]++;
  return Object.values(n).reduce((s, [p, q]) => s + Math.min(p, q), 0);
}

/** What happens when two tiles are put together: a zero pair, a red and a white of different shapes, or two of one colour. */
export function pairOf(a: Tile, b: Tile): 'zero' | 'unlike' | 'same-sign' {
  if (a.sign === b.sign) return 'same-sign';
  return a.kind === b.kind ? 'zero' : 'unlike';
}

/** Like terms side by side, biggest tiles first, white before red: the picture of collecting like terms. */
export function sortTiles<T extends Tile>(tiles: T[]): T[] {
  return tiles.map((t, i) => [t, i] as const).sort(([a, i], [b, j]) => kindOrder(a.kind, b.kind) || b.sign - a.sign || i - j).map(([t]) => t);
}

/** The number a tile of this kind shows when every letter is given a value (the colour adds the sign). */
export const tileValue = (kind: string, values: Record<string, number>) => evaluate({ [kind]: 1 }, values);

/**
 * What a flipped tile shows, ASCII: the letter's value, or the product it stands for, so the learner still works it out:
 * x = −3 → x shows "(-3)", x² shows "(-3)^2", xy with y = 2 shows "(-3)*2".
 */
export function tileValueText(kind: string, values: Record<string, number>): string {
  if (kind === '1') return '1';
  const v = (s: string) => (values[s] < 0 ? `(${values[s]})` : String(values[s]));
  return Object.entries(powsOf(kind)).map(([s, e]) => (e === 1 ? v(s) : `${v(s)}^${e}`)).join('*').replace(/^\((-?\d+(?:\.\d+)?)\)$/, '$1');
}
