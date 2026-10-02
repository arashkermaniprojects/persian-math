import { describe, expect, it } from 'vitest';
import { isTileKind, matPoly, pairOf, sortTiles, tileValue, tileValueText, tilesOf, zeroPairs } from './algebra-tiles-mat';
import { format } from './algebra-tiles-poly';

const keys = (s: string) => tilesOf(s).map((t) => (t.sign < 0 ? '-' : '') + t.kind);

describe('tiles', () => {
  it('lays out an expression as written, not combined', () => {
    expect(keys('2x + 3 - x')).toEqual(['x', 'x', '1', '1', '1', '-x']);
    expect(keys('x^2 + x - 2')).toEqual(['x^2', 'x', '-1', '-1']);
    expect(keys('-y^2 + xy')).toEqual(['-y^2', 'x*y']);
  });

  it('refuses what is not whole tiles', () => {
    expect(() => tilesOf('2.5x')).toThrow();
    expect(() => tilesOf('x^3')).toThrow();
    expect(() => tilesOf('x +')).toThrow();
    expect(isTileKind('x*y')).toBe(true);
    expect(isTileKind('x^2*y')).toBe(false);
  });

  it('reads the mat back and counts zero pairs', () => {
    const t = tilesOf('2x^2 + 3x + 1 - x + x^2 - 4');
    expect(format(matPoly(t))).toBe('3x^2 + 2x - 3');
    expect(zeroPairs(t)).toBe(2); // x with −x, 1 with −1
    expect(zeroPairs(tilesOf('x - 1'))).toBe(0);
    expect(matPoly([])).toEqual({});
  });

  it('only a red and a white of the same shape make a zero pair', () => {
    expect(pairOf({ kind: 'x', sign: 1 }, { kind: 'x', sign: -1 })).toBe('zero');
    expect(pairOf({ kind: 'x', sign: -1 }, { kind: '1', sign: 1 })).toBe('unlike');
    expect(pairOf({ kind: 'x', sign: 1 }, { kind: 'x', sign: 1 })).toBe('same-sign');
  });

  it('sorts like terms together, big tiles first, white before red, keeping the order within a group', () => {
    const t = tilesOf('1 - x + x^2 - 1 + x').map((x, i) => ({ ...x, id: i }));
    expect(sortTiles(t).map((x) => x.id)).toEqual([2, 4, 1, 0, 3]);
  });

  it('shows the value of each tile when the letters are given', () => {
    expect(tileValue('x^2', { x: -3 })).toBe(9);
    expect(tileValue('x', { x: 3 })).toBe(3);
    expect(tileValueText('x', { x: 3 })).toBe('3');
    expect(tileValueText('x', { x: -3 })).toBe('-3');
    expect(tileValueText('x^2', { x: -3 })).toBe('(-3)^2');
    expect(tileValueText('x^2', { x: 3 })).toBe('3^2');
    expect(tileValueText('x*y', { x: 2, y: -1 })).toBe('2*(-1)');
    expect(tileValueText('1', { x: 2 })).toBe('1');
  });
});
