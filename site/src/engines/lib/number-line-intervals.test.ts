import { describe, expect, it } from 'vitest';
import {
  cellSamples, checkInterval, complement, criticalPoints, holds, inequalityTexts, inSet, intervalText, normalize,
  parseIneq, parseIntervals, pieceOf, sameSet, signTable, solveLinear, zeroOf, type IntervalCheck, type Piece, type SignState,
} from './number-line-intervals';
import { evaluate } from '../../lib/checks';

const FA = { digits: '۰۱۲۳۴۵۶۷۸۹', decimal: '/' };
const AF = { digits: '۰۱۲۳۴۵۶۷۸۹', decimal: ',' };
const EN = { digits: '0123456789', decimal: '.' };
const P = parseIntervals;

describe('parseIntervals', () => {
  it('reads brackets, infinity and unions', () => {
    expect(P('[-2, 4)')).toEqual([{ from: -2, to: 4, open: [false, true] }]);
    expect(P('(3, inf)')).toEqual([{ from: 3, to: null, open: [true, true] }]);
    expect(P('(−∞, 1]')).toEqual([{ from: null, to: 1, open: [true, false] }]);
    expect(P('(-inf, -2) U [1, inf)')).toHaveLength(2);
    expect(P('(-inf, -2) ∪ [1, inf)')).toHaveLength(2);
    expect(P('[7/2, 5]')[0].from).toBe(3.5);
    expect(P('{2}')).toEqual([{ from: 2, to: 2, open: [false, false] }]);
    expect(P('R')).toEqual([{ from: null, to: null, open: [true, true] }]);
    expect(P('')).toEqual([]);
    expect(P('[2، 5)')).toEqual([{ from: 2, to: 5, open: [false, true] }]);
  });
  it('an infinite end is always open, even written with a square bracket', () => {
    expect(P('[3, inf]')[0].open).toEqual([false, true]);
  });
  it('rejects junk', () => {
    expect(() => P('3 < x')).toThrow();
    expect(() => P('[a, 3]')).toThrow();
  });
  it('pieceOf takes strings or ends', () => {
    expect(pieceOf({ from: 1, to: null, open: true })).toEqual([{ from: 1, to: null, open: [true, true] }]);
    expect(pieceOf({ from: 1, to: 2 })).toEqual([{ from: 1, to: 2, open: [false, false] }]);
    expect(pieceOf('(1, 2]')).toEqual([{ from: 1, to: 2, open: [true, false] }]);
  });
});

describe('sets', () => {
  it('membership respects open and closed ends', () => {
    const s = P('[-2, 4)');
    expect(inSet(s, -2)).toBe(true);
    expect(inSet(s, 4)).toBe(false);
    expect(inSet(s, 3.99)).toBe(true);
    expect(inSet(P('(3, inf)'), 3)).toBe(false);
    expect(inSet(P('(3, inf)'), 1e9)).toBe(true);
  });
  it('normalize merges touching pieces only when the join point is covered', () => {
    expect(normalize(P('[1, 2] U (2, 3)'))).toEqual(P('[1, 3)'));
    expect(normalize(P('[1, 2) U (2, 3)'))).toHaveLength(2);
    expect(normalize(P('(4, 6) U [0, 5]'))).toEqual(P('[0, 6)'));
    expect(normalize(P('(2, 2)'))).toEqual([]);
    expect(normalize(P('(-inf, 3) U [0, inf)'))).toEqual(P('R'));
  });
  it('sameSet compares sets, not how they were drawn', () => {
    expect(sameSet(P('[1, 2] U [2, 3]'), P('[1, 3]'))).toBe(true);
    expect(sameSet(P('(3, inf)'), P('[3, inf)'))).toBe(false);
  });
  it('complement', () => {
    expect(complement(P('(3, inf)'))).toEqual(P('(-inf, 3]'));
    expect(complement(P('[-2, 4)'))).toEqual(P('(-inf, -2) U [4, inf)'));
    expect(complement([])).toEqual(P('R'));
    expect(complement(P('R'))).toEqual([]);
  });
});

describe('notation', () => {
  it('interval notation runs left to right, with the locale digits and separator', () => {
    expect(intervalText(P('[-2, 4)'), FA)).toBe('[−۲, ۴)');
    expect(intervalText(P('[-2, 4)'), AF)).toBe('[−۲، ۴)');
    expect(intervalText(P('(-inf, 1.5]'), FA)).toBe('(−∞, ۱/۵]');
    expect(intervalText(P('(-inf, 1.5]'), AF)).toBe('(−∞، ۱,۵]');
    expect(intervalText(P('(3, inf) U (-inf, -1]'), EN)).toBe('(−∞, −1] ∪ (3, ∞)');
    expect(intervalText([], EN)).toBe('∅');
    expect(intervalText(P('{2}'), EN)).toBe('{2}');
  });
  it('inequalities: the variable on the left for rays, in the middle for segments', () => {
    expect(inequalityTexts(P('(3, inf)'), EN)).toEqual(['x > 3']);
    expect(inequalityTexts(P('[3, inf)'), EN)).toEqual(['x ≥ 3']);
    expect(inequalityTexts(P('(-inf, 1]'), FA)).toEqual(['x ≤ ۱']);
    expect(inequalityTexts(P('[-2, 4)'), FA)).toEqual(['−۲ ≤ x < ۴']);
    expect(inequalityTexts(P('(-inf, -2) U [1, inf)'), EN, 'y')).toEqual(['y < −2', 'y ≥ 1']);
    expect(inequalityTexts(P('[2, 2]'), EN)).toEqual(['x = 2']);
  });
});

describe('linear inequalities', () => {
  it('solves, flipping when the x coefficient is negative', () => {
    expect(solveLinear(parseIneq('2x - 1 < 7'))).toEqual(P('(-inf, 4)'));
    expect(solveLinear(parseIneq('-3x >= 6'))).toEqual(P('(-inf, -2]'));
    expect(solveLinear(parseIneq('-3x ≥ 6'))).toEqual(P('(-inf, -2]'));
    expect(solveLinear(parseIneq('3 < x'))).toEqual(P('(3, inf)'));
    expect(solveLinear(parseIneq('5 - x <= 2'))).toEqual(P('[3, inf)'));
    expect(solveLinear(parseIneq('-x > 1'))).toEqual(P('(-inf, -1)'));
    expect(solveLinear(parseIneq('2(x + 1) > x + 5'))).toEqual(P('(3, inf)'));
    expect(solveLinear(parseIneq('x + 1 > x'))).toEqual(P('R'));
    expect(solveLinear(parseIneq('x > x + 1'))).toEqual([]);
  });
  it('tests one value', () => {
    const q = parseIneq('-3x >= 6');
    expect(holds(q, -4)).toEqual({ l: 12, r: 6, ok: true });
    expect(holds(q, -2).ok).toBe(true);
    expect(holds(q, 0).ok).toBe(false);
    expect(holds(parseIneq('2x - 1 < 7'), 4).ok).toBe(false);
    expect(() => parseIneq('2x = 3')).toThrow();
  });
});

describe('sign rows', () => {
  it('zeros and critical points', () => {
    expect(zeroOf('x - 1')).toBe(1);
    expect(zeroOf('2x + 3')).toBe(-1.5);
    expect(zeroOf('3 - x')).toBe(3);
    expect(zeroOf('5')).toBeNull();
    expect(criticalPoints(['x - 1', 'x + 2', 'x - 1'])).toEqual([-2, 1]);
    expect(cellSamples([-2, 1])).toEqual([-3, -0.5, 2]);
  });
  it('a product or quotient of linear factors', () => {
    expect(signTable(['x - 1', 'x + 2'])).toEqual([['-', '-', '+'], ['-', '+', '+'], ['+', '-', '+']]);
    expect(signTable(['2x - 4'])).toEqual([['-', '+'], ['-', '+']]);
    expect(signTable(['3 - x'])).toEqual([['+', '-'], ['+', '-']]);
  });
  it('a repeated factor does not change the sign', () => {
    const t = signTable(['x - 1', 'x - 1', 'x + 2']);
    expect(t[t.length - 1]).toEqual(['-', '+', '+']);
  });
});

describe('interval check', () => {
  const st = (s: string): { intervals: Piece[] } => ({ intervals: P(s) });
  const run = (c: Omit<IntervalCheck, 'type'>, s: { intervals?: Piece[]; signs?: SignState } | undefined) => checkInterval({ type: 'interval', ...c }, s);
  it('passes the same set however it was drawn', () => {
    expect(run({ value: '(3, inf)' }, st('(3, inf)')).ok).toBe(true);
    expect(run({ value: '[1, 3]' }, st('[1, 2] U [2, 3]')).ok).toBe(true);
    expect(run({ from: -2, to: 4, open: [false, true] }, st('[-2, 4)')).ok).toBe(true);
    expect(run({ union: ['(-inf, -2)', '[1, inf)'] }, st('[1, inf) U (-inf, -2)')).ok).toBe(true);
  });
  it('names the classic slips', () => {
    expect(run({ value: '(3, inf)' }, st(''))).toEqual({ ok: false, code: 'empty' });
    expect(run({ value: '(3, inf)' }, undefined)).toEqual({ ok: false, code: 'empty' });
    expect(run({ value: '(3, inf)' }, st('[3, inf)')).code).toBe('open-closed');
    expect(run({ value: '[-2, 4)' }, st('[-2, 4]')).code).toBe('open-closed');
    expect(run({ value: '(3, inf)' }, st('(-inf, 3)')).code).toBe('wrong-direction');
    expect(run({ value: '(-inf, 1]' }, st('[1, inf)')).code).toBe('wrong-direction');
    expect(run({ value: '(-inf, -2]', flipped: true }, st('[-2, inf)')).code).toBe('sign-not-flipped');
    expect(run({ value: '(-inf, 4)' }, st('(-inf, 5)')).code).toBe('wrong-end');
    expect(run({ value: '(-inf, 4)' }, st('(-inf, 1) U (2, 3)')).code).toBe('pieces');
    expect(run({ value: '(3, inf)' }, st('(3, 6]')).code).toBe('not-ray');
    expect(run({ value: '[-2, 4)' }, st('[-2, 5)')).code).toBe('wrong-end');
    expect(run({ value: '(-inf, -2) U [1, inf)', poles: [-2] }, st('(-inf, -2] U [1, inf)')).code).toBe('pole-included');
  });
  it('traps come first', () => {
    expect(run({ value: '(-inf, 4)', traps: [{ value: '(-inf, 3)', code: 'subtracted' }] }, st('(-inf, 3)')).code).toBe('subtracted');
  });
  it('sign rows', () => {
    const want = signTable(['x - 1', 'x + 2']);
    const s = (cells: SignState['cells']) => ({ signs: { cells, want } });
    expect(run({ signs: true }, s(want)).ok).toBe(true);
    expect(run({ signs: true }, s([['-', '-', '+'], ['-', '+', '+'], ['+', '', '+']])).code).toBe('signs-empty');
    expect(run({ signs: true }, s([['-', '-', '+'], ['-', '+', '+'], ['-', '-', '+']])).code).toBe('signs-result');
    expect(run({ signs: true }, s([['+', '-', '+'], ['-', '+', '+'], ['+', '-', '+']])).code).toBe('signs-wrong');
    expect(run({ signs: true }, undefined).code).toBe('signs-empty');
    // repeated factor: alternating the result row past a double zero is its own slip
    const w2 = signTable(['x - 1', 'x - 1', 'x + 2']);
    const cells = [...w2.slice(0, -1), ['+', '-', '+'] as const].map((r) => [...r]);
    expect(checkInterval({ type: 'interval', signs: true }, { signs: { cells: cells as SignState['cells'], want: w2 } }).code).toBe('signs-alternate');
    // signs right, then the set
    expect(run({ signs: true, value: '(-inf, -2] U [1, inf)' }, { ...s(want), intervals: P('(-inf, -2] U [1, inf)') }).ok).toBe(true);
  });
  it('runs through evaluate()', () => {
    expect(evaluate({ type: 'interval', value: '(3, inf)' }, { state: { intervals: P('(3, inf)') } }).ok).toBe(true);
    expect(evaluate({ type: 'interval', value: '(3, inf)' }, { state: { intervals: P('[3, inf)') } }).code).toBe('open-closed');
  });
});
