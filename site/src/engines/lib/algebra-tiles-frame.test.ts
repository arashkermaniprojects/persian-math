import { describe, expect, it } from 'vitest';
import { areaOf, blocksOf, cellOf, gridTotal, headingsOf, sameSides, segsOf, sideText } from './algebra-tiles-frame';
import { format } from './algebra-tiles-poly';

describe('rectangle', () => {
  it('reads a side as groups of equal pieces', () => {
    expect(segsOf('x + 4')).toEqual([{ kind: 'x', sign: 1, n: 1 }, { kind: '1', sign: 1, n: 4 }]);
    expect(segsOf('x - 2')).toEqual([{ kind: 'x', sign: 1, n: 1 }, { kind: '1', sign: -1, n: 2 }]);
    expect(segsOf('3')).toEqual([{ kind: '1', sign: 1, n: 3 }]);
    expect(sideText(segsOf('4 + 2x'))).toBe('2x + 4');
    expect(() => segsOf('x/2')).toThrow();
    expect(() => segsOf('1.5x')).toThrow();
  });

  it('makes one block of tiles for each pair of groups', () => {
    const b = blocksOf(segsOf('3'), segsOf('x + 4'));
    expect(b.map((x) => [x.tile, x.count])).toEqual([['x', 3], ['1', 12]]);
    const c = blocksOf(segsOf('x - 2'), segsOf('x + 3'));
    expect(c.map((x) => [x.tile, x.count])).toEqual([['x^2', 1], ['x', 3], ['-x', 2], ['-1', 6]]);
    expect(format(areaOf(segsOf('x + 2'), segsOf('x + 3')))).toBe('x^2 + 5x + 6');
  });

  it('compares sides in either order', () => {
    expect(sameSides(['x + 2', 'x + 3'], ['3 + x', 'x + 2'])).toBe(true);
    expect(sameSides(['2', '6x + 4'], ['4', '3x + 2'])).toBe(false);
    expect(sameSides(['x +', 'x'], ['x', 'x'])).toBe(false);
  });
});

describe('grid', () => {
  it('multiplies headings into cells and adds the cells up', () => {
    expect(cellOf('x', 'x')).toBe('x^2');
    expect(cellOf('-3', '2x')).toBe('-6x');
    expect(cellOf(null, 'x')).toBeNull();
    expect(cellOf('x +', 'x')).toBeNull();
    expect(format(gridTotal([['x^2', '2x'], ['3x', '6']])!)).toBe('x^2 + 5x + 6');
    expect(gridTotal([['x^2', null]])).toBeNull();
    expect(headingsOf('x + 3')).toEqual(['x', '3']);
    expect(headingsOf('2x - 5')).toEqual(['2x', '-5']);
  });
});
