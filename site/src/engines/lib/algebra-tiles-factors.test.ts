import { describe, expect, it } from 'vitest';
import {
  atoms, boardCode, boardText, byBoth, find, judgeExcluded, judgeResult, makeBoard, primes, readFactors, sameChip, sameForm, sameValue,
  splitChip, splitOf, tap, unwrap, type Frac,
} from './algebra-tiles-factors';

const ids = (b: Frac[], side: 'top' | 'bottom', fi = 0) => b[fi][side].map((c) => c.id);
const fs = (b: Frac[], side: 'top' | 'bottom', fi = 0) => b[fi][side].filter((c) => !c.out).map((c) => c.f);

describe('splitting chips', () => {
  it('primes and brackets', () => {
    expect(primes(12)).toEqual([2, 2, 3]);
    expect(primes(97)).toEqual([97]);
    expect(primes(1)).toEqual([]);
    expect(unwrap('(x + 3)')).toBe('x + 3');
    expect(unwrap('(a)(b)')).toBe('(a)(b)');
  });
  it('a power splits into copies of its base; a power of a power into copies of the inner power', () => {
    expect(splitOf('2^3')?.chips).toEqual(['2', '2', '2']);
    expect(splitOf('a^5')?.chips).toEqual(['a', 'a', 'a', 'a', 'a']);
    expect(splitOf('(a^2)^3')?.chips).toEqual(['a^2', 'a^2', 'a^2']);
    expect(splitOf('(x + 3)^2')?.chips).toEqual(['x + 3', 'x + 3']);
  });
  it('numbers into primes, monomials into numbers and letters; atoms do not split', () => {
    expect(splitOf('12')?.chips).toEqual(['2', '2', '3']);
    expect(splitOf('6a^2')?.chips).toEqual(['2', '3', 'a', 'a']);
    expect(splitOf('7')).toBeNull();
    expect(splitOf('a')).toBeNull();
    expect(splitOf('x + 3')).toBeNull();
  });
  it('sums: a common number factor, x² + bx + c with whole roots, a difference of squares', () => {
    expect(splitOf('2x + 6')?.chips).toEqual(['2', 'x + 3']);
    expect(splitOf('x^2 - 9')?.chips).toEqual(['x + 3', 'x - 3']);
    expect(splitOf('x^2 + 5x + 6')?.chips).toEqual(['x + 3', 'x + 2']);
    expect(splitOf('x^2 + 9')).toBeNull();
    expect(splitOf('2x^2 + 5x + 3')).toBeNull();
    expect(splitOf('2x^2 + 5x + 3', { '2x^2 + 5x + 3': ['2x + 3', 'x + 1'] })?.chips).toEqual(['2x + 3', 'x + 1']);
  });
  it('a root splits under itself', () => {
    expect(splitOf('√12')).toEqual({ chips: ['2', '2', '3'], root: true });
    expect(splitOf('√3')).toBeNull();
  });
  it('chips are equal by value', () => {
    expect(sameChip('x + 3', '3 + x')).toBe(true);
    expect(sameChip('2^3', '8')).toBe(true);
    expect(sameChip('√3', '3')).toBe(false);
    expect(atoms('x^2 - 9')).toEqual(['x + 3', 'x - 3']);
    expect(atoms('12')).toEqual(['2', '2', '3']);
  });
});

describe('the board', () => {
  it('2³ × 2⁴: split both, seven 2s', () => {
    const b = makeBoard([{ top: ['2^3', '2^4'] }]);
    expect(boardCode(b, { expanded: true })).toBe('not-expanded');
    const [p, q] = ids(b, 'top');
    expect(splitChip(b, p)).toBe(true);
    expect(splitChip(b, q)).toBe(true);
    expect(fs(b, 'top')).toEqual(Array(7).fill('2'));
    expect(splitChip(b, ids(b, 'top')[0])).toBe(false);
    expect(boardCode(b, { expanded: true })).toBeNull();
    expect(boardText(b)).toBe('2*2*2*2*2*2*2');
  });
  it('a⁵ ÷ a²: cancel equal chips above and below; a power is split first', () => {
    const b = makeBoard([{ top: ['a^5'], bottom: ['a^2'] }]);
    expect(boardCode(b, { fullyCancelled: true })).toBe('not-split');
    expect(tap(b, ids(b, 'top')[0], ids(b, 'bottom')[0])).toMatchObject({ did: 'refuse', why: 'split-first' });
    splitChip(b, ids(b, 'top')[0]);
    splitChip(b, ids(b, 'bottom')[0]);
    expect(tap(b, ids(b, 'top')[0], ids(b, 'bottom')[0]).did).toBe('cancel');
    expect(boardCode(b, { fullyCancelled: true })).toBe('not-cancelled');
    expect(tap(b, ids(b, 'top')[1], ids(b, 'bottom')[1]).did).toBe('cancel');
    expect(boardCode(b, { fullyCancelled: true })).toBeNull();
    expect(boardText(b)).toBe('a*a*a');
  });
  it('2² ÷ 2⁵ leaves three 2s below; a³ ÷ a³ leaves 1', () => {
    const b = makeBoard([{ top: ['2^2'], bottom: ['2^5'] }]);
    splitChip(b, ids(b, 'top')[0]);
    splitChip(b, ids(b, 'bottom')[0]);
    for (let k = 0; k < 2; k++) tap(b, ids(b, 'top')[k], ids(b, 'bottom')[k]);
    expect(boardText(b)).toBe('1/(2*2*2)');
    const c = makeBoard([{ top: ['a'], bottom: ['a'] }]);
    tap(c, ids(c, 'top')[0], ids(c, 'bottom')[0]);
    expect(boardText(c)).toBe('1');
  });
  it('(x² − 9)/(x + 3): the whole bracket cancels; a term does not', () => {
    const b = makeBoard([{ top: ['x^2 - 9'], bottom: ['x + 3'] }]);
    expect(boardCode(b, { fullyCancelled: true })).toBe('not-split');
    splitChip(b, ids(b, 'top')[0]);
    expect(boardText(b)).toBe('((x + 3)*(x - 3))/(x + 3)');
    expect(tap(b, ids(b, 'top')[0], ids(b, 'bottom')[0]).did).toBe('cancel');
    expect(boardText(b)).toBe('x - 3');
    const c = makeBoard([{ top: ['x + 3'], bottom: ['3'] }]);
    expect(tap(c, ids(c, 'top')[0], ids(c, 'bottom')[0])).toMatchObject({ did: 'refuse', why: 'cancel-terms' });
    expect(boardCode(c, { fullyCancelled: true })).toBeNull();
  });
  it('√12: a pair under the root comes out as one chip', () => {
    const b = makeBoard([{ top: ['√12'] }]);
    expect(boardCode(b, { fullyCancelled: true })).toBe('not-split');
    splitChip(b, ids(b, 'top')[0]);
    const root = b[0].top[0];
    expect(root.root!.map((c) => c.f)).toEqual(['2', '2', '3']);
    expect(boardCode(b, { fullyCancelled: true })).toBe('pair-in-root');
    expect(tap(b, root.root![0].id, root.root![2].id).did).toBe('select'); // 2 and 3: not a pair
    expect(tap(b, root.root![0].id, root.root![1].id).did).toBe('pair');
    expect(boardText(b)).toBe('2*√3');
    expect(boardCode(b, { fullyCancelled: true, expanded: true })).toBeNull();
    expect(find(b, root.id)?.side).toBe('top');
  });
  it('two roots join; √3 × √3 = 3; rationalising clears the root below', () => {
    const b = makeBoard([{ top: ['√2', '√3'] }]);
    expect(tap(b, ids(b, 'top')[0], ids(b, 'top')[1]).did).toBe('roots');
    expect(boardText(b)).toBe('√(2*3)');
    const c = makeBoard([{ top: ['1'], bottom: ['√3'] }]);
    expect(boardCode(c, { rational: true })).toBe('root-below');
    byBoth(c, 0, '√3');
    const [r1, r2] = ids(c, 'bottom');
    expect(tap(c, r1, r2).did).toBe('roots');
    const root = c[0].bottom[0];
    expect(tap(c, root.root![0].id, root.root![1].id).did).toBe('pair');
    expect(boardText(c)).toBe('(1*√3)/3');
    expect(boardCode(c, { rational: true, fullyCancelled: true })).toBeNull();
  });
  it('fractions with the same bottom', () => {
    const b = makeBoard([{ top: ['1'], bottom: ['x'] }, { top: ['1'], bottom: ['2'] }]);
    expect(boardCode(b, { sameBottom: true })).toBe('bottoms-differ');
    byBoth(b, 0, '2');
    byBoth(b, 1, 'x');
    expect(boardCode(b, { sameBottom: true })).toBeNull();
    expect(tap(b, ids(b, 'top', 0)[0], ids(b, 'bottom', 1)[0])).toMatchObject({ did: 'refuse', why: 'other-fraction' });
  });
});

describe('reading a typed answer', () => {
  const r = (s: string) => readFactors(s)!;
  it('powers, roots, brackets and fractions', () => {
    expect(r('2^7').f).toEqual([{ base: '2', exp: 7 }]);
    expect(r('۲^-۳').f).toEqual([{ base: '2', exp: -3 }]);
    expect(r('1/2^3').f).toEqual([{ base: '1', exp: 1 }, { base: '2', exp: -3 }]);
    expect(r('2√3').f).toEqual([{ base: '2', exp: 1 }, { base: '3', exp: 0.5 }]);
    expect(r('9^(1/2)').f).toEqual([{ base: '9', exp: 0.5 }]);
    expect(r('(a^2)^3').f).toEqual([{ base: 'a', exp: 6 }]);
    expect(r('(x - 3)/(x + 2)').f).toEqual([{ base: 'x - 3', exp: 1 }, { base: 'x + 2', exp: -1 }]);
    expect(r('x - 3').f).toEqual([{ base: 'x - 3', exp: 1 }]);
    expect(r('-2').sign).toBe(-1);
    expect(r('(-2)^3').sign).toBe(-1);
    expect(r('a²').f).toEqual([{ base: 'a', exp: 2 }]);
    expect(readFactors('2^')).toBeNull();
    expect(readFactors('')).toBeNull();
  });
  it('form and value', () => {
    expect(sameForm(r('2^-3'), r('1/2^3'))).toBe(true);
    expect(sameForm(r('2^7'), r('128'))).toBe(false);
    expect(sameValue(r('2^7'), r('128'))).toBe(true);
    expect(sameValue(r('√12'), r('2√3'))).toBe(true);
    expect(sameValue(r('0.5'), r('1/2'))).toBe(true);
    expect(sameValue(r('(x^2 - 9)/(x + 3)'), r('x - 3'))).toBe(true);
    expect(sameValue(r('a^0'), r('1'))).toBe(true);
  });
  it('judges the answer: traps, form, the classic slips', () => {
    const traps = [{ write: '4^7', code: 'base-multiplied' }, { write: '2^12', code: 'index-multiplied' }];
    expect(judgeResult('2^7', '2^7', traps)).toBeNull();
    expect(judgeResult('۲^۷', '2^7', traps)).toBeNull();
    expect(judgeResult('4^7', '2^7', traps)).toBe('base-multiplied');
    expect(judgeResult('4096', '2^7', traps)).toBe('index-multiplied'); // the value of a trap
    expect(judgeResult('128', '2^7', traps)).toBe('form');
    expect(judgeResult('2^3*2^4', '2^7', traps)).toBe('not-simplified');
    expect(judgeResult('2^8', '2^7', traps)).toBe('wrong-index');
    expect(judgeResult('', '2^7')).toBe('empty');
    expect(judgeResult('2^', '2^7')).toBe('syntax');
    expect(judgeResult('0', '1')).toBe('zero-power-zero');
    expect(judgeResult('1', '1')).toBeNull();
    expect(judgeResult('-8', '2^-3')).toBe('negative-power-negative');
    expect(judgeResult('1/2^3', '2^-3')).toBeNull();
    expect(judgeResult('1/8', '2^-3')).toBe('form');
    expect(judgeResult('√12', '2√3')).toBe('form');
    expect(judgeResult('0.5', '1/2')).toBeNull(); // a plain number: any form
    expect(judgeResult('x - 3', '(x - 3)')).toBeNull();
    expect(judgeResult('(x^2 - 9)/(x + 3)', 'x - 3')).toBe('form');
    expect(judgeResult('x', 'x - 3')).toBe('wrong-result');
  });
  it('the values that are not allowed, in any order', () => {
    expect(judgeExcluded(['-3'], [-3])).toBeNull();
    expect(judgeExcluded(['3', '-3'], [-3, 3])).toBeNull();
    expect(judgeExcluded([null], [-3])).toBe('excluded-empty');
    expect(judgeExcluded(['3'], [-3])).toBe('excluded-sign');
    expect(judgeExcluded(['2'], [-3])).toBe('excluded-wrong');
    expect(judgeExcluded(['3', '3'], [3, -2])).toBe('excluded-missing');
  });
});
