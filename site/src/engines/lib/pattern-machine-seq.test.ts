import { describe, expect, it } from 'vitest';
import { continueJumps, figureCount, figureRows, inSet, members, setCode, sticks, term, terms } from './pattern-machine-seq';

describe('number sequences', () => {
  it('runs term to term with + − ×', () => {
    expect(terms({ start: 0, step: 7 }, 5)).toEqual([0, 7, 14, 21, 28]);
    expect(terms({ start: 50, step: 5, op: '-' }, 4)).toEqual([50, 45, 40, 35]);
    expect(terms({ start: 1, step: 2, op: '×' }, 5)).toEqual([1, 2, 4, 8, 16]);
    expect(term({ start: 0.5, step: 0.1 }, 3)).toBe(0.7);
  });
  it('uses a position-to-term rule or written terms', () => {
    expect(terms({ rule: '3n + 1' }, 4)).toEqual([4, 7, 10, 13]);
    expect(terms({ rule: 'n^2' }, 4)).toEqual([1, 4, 9, 16]);
    expect(term({ terms: [1, 1, 2, 3, 5] }, 5)).toBe(5);
  });
});

describe('growing figures', () => {
  it('counts matchsticks: squares in a row 3n + 1, triangles 2n + 1', () => {
    const sq = { figure: 'sticks' as const };
    expect([1, 2, 3, 4, 10].map((n) => figureCount(sq, n))).toEqual([4, 7, 10, 13, 31]);
    const tri = { figure: 'sticks' as const, shape: 'triangles' as const };
    expect([1, 2, 3, 10].map((n) => figureCount(tri, n))).toEqual([3, 5, 7, 21]);
  });
  it('never repeats a stick', () => {
    for (const shape of ['squares', 'triangles'] as const) {
      const s = sticks({ figure: 'sticks', shape }, 6).map((x) => x.map((v) => v.toFixed(2)).join());
      expect(new Set(s).size).toBe(s.length);
    }
  });
  it('builds grids that grow by rows and columns', () => {
    expect(figureRows({ rows: [1, 1], cols: [1, 1] }, 3)).toEqual([3, 3, 3]); // square numbers
    expect(figureCount({ rows: [1, 1], cols: [1, 1] }, 5)).toBe(25);
    expect(figureCount({ rows: [2, 0], cols: [1, 1] }, 4)).toBe(8); // even numbers
    expect(figureCount({ rows: [1, 1], cols: [2, 1] }, 3)).toBe(12); // n(n + 1)
    expect(figureCount({}, 4)).toBe(4); // default: a line growing by one
  });
  it('builds stairs (triangular numbers)', () => {
    expect(figureRows({ shape: 'stairs' }, 3)).toEqual([3, 2, 1]);
    expect([1, 2, 3, 4].map((n) => figureCount({ shape: 'stairs' }, n))).toEqual([1, 3, 6, 10]);
  });
});

describe('hundred square sets', () => {
  it('lists multiples, factors, a set and an intersection', () => {
    expect(members({ multiples: 25 }, 1, 100)).toEqual([25, 50, 75, 100]);
    expect(members({ factors: 12 }, 1, 100)).toEqual([1, 2, 3, 4, 6, 12]);
    expect(members({ set: [2, 3, 101] }, 1, 100)).toEqual([2, 3]);
    expect(members({ and: [{ multiples: 4 }, { multiples: 6 }] }, 1, 50)).toEqual([12, 24, 36, 48]);
    expect(inSet({ multiples: 3 }, 0)).toBe(false);
  });
  it('codes shading: empty, missing before extra', () => {
    expect(setCode([], [3])).toBe('empty');
    expect(setCode([3, 6], [3, 6, 9])).toBe('missing');
    expect(setCode([3, 6, 9, 10], [3, 6, 9])).toBe('extra');
    expect(setCode([9, 3, 6], [3, 6, 9])).toBeNull();
  });
  it('continues the jumps from the last two shaded numbers', () => {
    expect(continueJumps([3, 6], 20)).toEqual([9, 12, 15, 18]);
    expect(continueJumps([7], 20)).toEqual([]);
    expect(continueJumps([10, 4], 20)).toEqual([]);
    expect(continueJumps([1, 2, 5, 9], 20)).toEqual([13, 17]);
  });
});
