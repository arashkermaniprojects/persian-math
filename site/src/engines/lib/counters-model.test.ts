import { describe, expect, it } from 'vitest';
import {
  addCounter, arrayShape, compact, factorPairs, initialCounters, isPrime, leaves, nodeAt, removeAt, splitColor, splitNode,
  treeDone, zoneState, type TreeNode,
} from './counters-model';

describe('counters model: zones of counters', () => {
  it('fills red counters, or red then yellow, and locks the first ones', () => {
    expect(initialCounters(3)).toEqual([{ c: 0 }, { c: 0 }, { c: 0 }]);
    expect(initialCounters([1, 2], 1)).toEqual([{ c: 0, l: true }, { c: 1 }, { c: 1 }]);
    expect(initialCounters(undefined)).toEqual([]);
  });

  it('a ten-frame fills from its first place and keeps its 10 places', () => {
    const f = compact(initialCounters(3), 10);
    expect(f).toHaveLength(10);
    expect(f.slice(0, 4).map(Boolean)).toEqual([true, true, true, false]);
    // more counters than places: nothing is lost
    expect(compact(initialCounters(12), 10)).toHaveLength(12);
    // a group has no empty places
    expect(compact([null, { c: 0 }, null])).toEqual([{ c: 0 }]);
  });

  it('adds in the first empty place, up to the capacity', () => {
    const f = compact(initialCounters(9), 10);
    const g = addCounter(f, { c: 1 }, 10, 10)!;
    expect(zoneState(g).colors).toEqual([9, 1]);
    expect(addCounter(g, { c: 1 }, 10, 10)).toBeNull();
  });

  it('removes a counter and closes the gap, but never a fixed one', () => {
    const f = compact(initialCounters(4, 1), 10);
    expect(removeAt(f, 0, 10)).toBeNull();
    expect(removeAt(f, 7, 10)).toBeNull();
    const [rest, c] = removeAt(f, 1, 10)!;
    expect(c).toEqual({ c: 0 });
    expect(rest.slice(0, 4).map(Boolean)).toEqual([true, true, true, false]);
  });

  it('zone state counts present, marked, and unmarked colours', () => {
    const items = [{ c: 0 as const, x: true }, { c: 0 as const }, { c: 1 as const }, null];
    expect(zoneState(items)).toEqual({ count: 3, marked: 1, colors: [1, 1] });
  });
});

describe('counters model: arrays', () => {
  it('rows × cols, or a fixed number of counters in rows of cols, whose last row may be short', () => {
    expect(arrayShape(3, 4)).toEqual({ rows: 3, cols: 4, n: 12, full: true });
    expect(arrayShape(1, 5, 12)).toEqual({ rows: 3, cols: 5, n: 12, full: false });
    expect(arrayShape(1, 4, 12)).toEqual({ rows: 3, cols: 4, n: 12, full: true });
    expect(arrayShape(9, 1, 7)).toEqual({ rows: 7, cols: 1, n: 7, full: true });
  });

  it('a split colours the columns after it yellow', () => {
    // 2 rows × 5 columns, split after 2 columns: 2 red + 3 yellow in each row
    const colours = Array.from({ length: 10 }, (_, i) => splitColor(i, 5, 2));
    expect(colours).toEqual([0, 0, 1, 1, 1, 0, 0, 1, 1, 1]);
    expect(splitColor(4, 5, 0)).toBe(0);
  });
});

describe('counters model: factor trees', () => {
  it('primes and factor pairs', () => {
    expect([1, 2, 3, 4, 9, 11, 25, 29].map(isPrime)).toEqual([false, true, true, false, false, true, false, true]);
    expect(factorPairs(12)).toEqual([[2, 6], [3, 4]]);
    expect(factorPairs(36)).toEqual([[2, 18], [3, 12], [4, 9], [6, 6]]);
    expect(factorPairs(7)).toEqual([]);
  });

  it('splitting leaves until all are prime finishes the tree, whatever the order', () => {
    const t: TreeNode = { v: 60 };
    expect(splitNode(t, '', 6)).toBe(true);
    expect(treeDone(t)).toBe(false);
    expect(splitNode(t, '0', 2)).toBe(true);
    expect(splitNode(t, '1', 2)).toBe(true);
    expect(nodeAt(t, '11')?.v).toBe(5);
    expect(leaves(t)).toEqual([2, 2, 3, 5]);
    expect(treeDone(t)).toBe(true);
  });

  it('refuses a split that is not a proper factor, or of a node already split', () => {
    const t: TreeNode = { v: 12 };
    expect(splitNode(t, '', 5)).toBe(false);
    expect(splitNode(t, '', 1)).toBe(false);
    expect(splitNode(t, '', 12)).toBe(false);
    expect(splitNode(t, '0', 2)).toBe(false);
    splitNode(t, '', 3);
    expect(splitNode(t, '', 2)).toBe(false);
  });
});
