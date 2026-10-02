import { describe, expect, it } from 'vitest';
import {
  countsToTable, exprElements, exprRegions, labelAt, makeLayout, membersFrom, OUT, parseOperand, regionAt, regionKey, relationHolds,
  repeats, sameSet, slots, symbolFamily, tableTotals, tableValue,
} from './discrete-lab-sets';

describe('layouts and regions', () => {
  it('names regions by the sets they are inside, in the given order', () => {
    expect(regionKey(['A', 'B'], ['B', 'A'])).toBe('AB');
    expect(regionKey(['A', 'B'], [])).toBe(OUT);
    expect(makeLayout(['A']).regions).toEqual(['A', OUT]);
    expect(makeLayout(['A', 'B']).regions).toEqual(['A', 'B', 'AB', OUT]);
    expect(makeLayout(['A', 'B', 'C']).regions).toEqual(['A', 'B', 'C', 'AB', 'AC', 'BC', 'ABC', OUT]);
  });

  it('nested ovals have no "only inner" region; separate ovals have no overlap', () => {
    const n = makeLayout(['B', 'C'], 'C⊆B');
    expect(n.kind).toBe('nest');
    expect(n.regions).toEqual(['B', 'BC', OUT]);
    expect(makeLayout(['B', 'C'], 'C ⊆ B').regions).toEqual(['B', 'BC', OUT]);
    expect(makeLayout(['A', 'B'], 'apart').regions).toEqual(['A', 'B', OUT]);
    // an unknown or self nesting falls back to overlapping ovals
    expect(makeLayout(['A', 'B'], 'A⊆A').kind).toBe('overlap');
  });

  it('finds the region under a point', () => {
    const L = makeLayout(['A', 'B']);
    expect(regionAt(L, 60, 125)).toBe('A');
    expect(regionAt(L, 180, 125)).toBe('AB');
    expect(regionAt(L, 300, 125)).toBe('B');
    expect(regionAt(L, 10, 290)).toBe(OUT);
    expect(regionAt(L, -5, 100)).toBeNull();
    const n = makeLayout(['B', 'C'], 'C⊆B');
    expect(regionAt(n, n.circles.C.x, n.circles.C.y)).toBe('BC');
    expect(regionAt(n, 90, 135)).toBe('B');
  });

  it('gives every region card slots inside it, apart from each other and away from the outlines', () => {
    for (const L of [makeLayout(['A']), makeLayout(['A', 'B']), makeLayout(['B', 'C'], 'C⊆B'), makeLayout(['A', 'B'], 'apart'), makeLayout(['A', 'B', 'C'])]) {
      const S = slots(L);
      for (const r of L.regions) {
        expect(S[r].length, `${L.kind} ${L.sets.join('')} ${r}`).toBeGreaterThan(0);
        for (const [x, y] of S[r]) expect(regionAt(L, x, y)).toBe(r);
        for (let i = 0; i < S[r].length; i++)
          for (let j = i + 1; j < S[r].length; j++) expect(Math.max(Math.abs(S[r][i][0] - S[r][j][0]), Math.abs(S[r][i][1] - S[r][j][1]))).toBeGreaterThanOrEqual(50);
      }
    }
    // enough room for the pilot missions: 9 cards outside one set, 4 in it; 5 per region with two sets
    const one = slots(makeLayout(['A']));
    expect(one[OUT].length).toBeGreaterThanOrEqual(9);
    expect(one.A.length).toBeGreaterThanOrEqual(5);
    const two = slots(makeLayout(['A', 'B']));
    expect(Math.min(two.A.length, two.B.length, two.AB.length)).toBeGreaterThanOrEqual(3);
    expect(two[OUT].length).toBeGreaterThanOrEqual(6);
  });

  it('writes set names outside their ovals and inside the rectangle', () => {
    const L = makeLayout(['A', 'B']);
    for (const [s, [x, y]] of Object.entries(labelAt(L))) {
      const c = L.circles[s];
      expect(Math.hypot(x - c.x, y - c.y)).toBeGreaterThan(c.r);
      expect(x).toBeGreaterThan(0);
      expect(y).toBeGreaterThan(0);
    }
    // the inner oval's name is inside the outer one
    const n = makeLayout(['B', 'C'], 'C⊆B'), [x, y] = labelAt(n).C;
    expect(regionAt(n, x, y)).toBe('B');
  });
});

describe('set expressions', () => {
  const L = makeLayout(['A', 'B']);
  it('evaluates union, intersection, difference and complement over regions', () => {
    expect(exprRegions('A ∪ B', L)).toEqual(['A', 'B', 'AB']);
    expect(exprRegions('A ∩ B', L)).toEqual(['AB']);
    expect(exprRegions('A − B', L)).toEqual(['A']);
    expect(exprRegions('B - A', L)).toEqual(['B']);
    expect(exprRegions('A′', L)).toEqual(['B', OUT]);
    expect(exprRegions("(A ∪ B)'", L)).toEqual([OUT]);
    expect(exprRegions('U', L)).toEqual(L.regions);
    expect(exprRegions('∅', L)).toEqual([]);
    // ∩ binds tighter than ∪
    const L3 = makeLayout(['A', 'B', 'C']);
    expect(exprRegions('A ∪ B ∩ C', L3).sort()).toEqual(['A', 'AB', 'ABC', 'AC', 'BC'].sort());
    expect(() => exprRegions('A ∪', L)).toThrow();
  });

  it('only "A" in a nested drawing is the ring around the inner oval', () => {
    const n = makeLayout(['B', 'C'], 'C⊆B');
    expect(exprRegions('B − C', n)).toEqual(['B']);
    expect(exprRegions('C − B', n)).toEqual([]);
    expect(exprRegions('B ∩ C', n)).toEqual(['BC']);
  });

  it('evaluates the elements of an expression', () => {
    const defs = { A: ['1', '2', '3', '6'], B: ['1', '2', '4', '8'] };
    const U = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    expect(exprElements('A ∪ B', defs, U)).toEqual(['1', '2', '3', '4', '6', '8']);
    expect(exprElements('A ∩ B', defs, U)).toEqual(['1', '2']);
    expect(exprElements('A − B', defs, U)).toEqual(['3', '6']);
    expect(exprElements('A′', defs, U)).toEqual(['4', '5', '7', '8', '9', '10']);
  });
});

describe('elements and relations', () => {
  it('compares sets ignoring order and repeats, and finds repeats', () => {
    expect(sameSet(['1', '2'], ['2', '1', '1'])).toBe(true);
    expect(sameSet(['1', '2'], ['1'])).toBe(false);
    expect(repeats(['1', '2', '1', '3', '2'])).toEqual(['1', '2']);
  });

  it('reads each set from where its cards are', () => {
    expect(membersFrom({ 1: 'A', 2: 'AB', 3: 'B', 4: OUT, 5: null }, ['A', 'B'])).toEqual({ A: ['1', '2'], B: ['2', '3'] });
  });

  it('parses elements, set literals, the empty set and names, in any digits', () => {
    expect(parseOperand('4')).toEqual({ kind: 'element', value: '4' });
    expect(parseOperand('۴')).toEqual({ kind: 'element', value: '4' });
    expect(parseOperand('{2, 4}')).toEqual({ kind: 'set', elems: ['2', '4'] });
    expect(parseOperand('{۲، ۴}')).toEqual({ kind: 'set', elems: ['2', '4'] });
    expect(parseOperand('∅')).toEqual({ kind: 'set', elems: [] });
    expect(parseOperand('{ }')).toEqual({ kind: 'set', elems: [] });
    expect(parseOperand('{0}')).toEqual({ kind: 'set', elems: ['0'] });
    expect(parseOperand('A', { A: ['2'] })).toEqual({ kind: 'set', elems: ['2'] });
  });

  it('decides ∈, ∉, ⊆, ⊄, = and ≠', () => {
    const A = parseOperand('{2, 4, 6, 8}'), el = (v: string) => parseOperand(v), st = (v: string) => parseOperand(v);
    expect(relationHolds(el('4'), '∈', A)).toBe(true);
    expect(relationHolds(el('5'), '∈', A)).toBe(false);
    expect(relationHolds(el('5'), '∉', A)).toBe(true);
    // {4} is a subset of A, not an element of it
    expect(relationHolds(st('{4}'), '∈', A)).toBe(false);
    expect(relationHolds(st('{4}'), '⊆', A)).toBe(true);
    expect(relationHolds(el('4'), '⊆', A)).toBe(false);
    expect(relationHolds(st('{4, 5}'), '⊄', A)).toBe(true);
    expect(relationHolds(st('∅'), '⊆', A)).toBe(true);
    // order and repeats don't matter; the empty set is not {0}
    expect(relationHolds(st('{2, 4}'), '=', st('{4, 2}'))).toBe(true);
    expect(relationHolds(st('{1, 2}'), '=', st('{2, 1, 1}'))).toBe(true);
    expect(relationHolds(st('∅'), '=', st('{0}'))).toBe(false);
    expect(relationHolds(st('∅'), '≠', st('{0}'))).toBe(true);
    expect(symbolFamily('∈')).toBe('element');
    expect(symbolFamily('⊄')).toBe('set');
    expect(symbolFamily('=')).toBe('equal');
  });
});

describe('two-way tables', () => {
  const v = [[5, 7], [3, 10]];
  it('adds rows, columns and the grand total', () => {
    expect(tableTotals(v)).toEqual({ rows: [12, 13], cols: [8, 17], all: 25 });
    expect(tableValue(v, '0,1')).toBe(7);
    expect(tableValue(v, '1,t')).toBe(13);
    expect(tableValue(v, 't,0')).toBe(8);
    expect(tableValue(v, 't,t')).toBe(25);
  });

  it('flips Venn region counts into the table: rows A, A′ and columns B, B′', () => {
    expect(countsToTable({ A: 7, AB: 5, B: 3, out: 5 }, ['A', 'B'])).toEqual([[5, 7], [3, 5]]);
    expect(countsToTable({ A: null, AB: 5 }, ['A', 'B'])).toEqual([[5, null], [null, null]]);
  });
});
