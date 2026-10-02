import { describe, expect, it } from 'vitest';
import { checkAlgebra, diagnose, type AlgebraCheck, type AlgebraState } from './algebra-tiles-check';
import { tilesOf } from './algebra-tiles-mat';
import { poly } from './algebra-tiles-poly';

const code = (c: Omit<AlgebraCheck, 'type'>, s: Partial<AlgebraState>) => checkAlgebra({ type: 'algebra', ...c }, { algebra: { mode: 'tiles', ...s } }).code ?? 'ok';
const d = (got: string, want: string) => diagnose(poly(got), poly(want)) ?? 'ok';

describe('diagnose', () => {
  it('names the classic slips', () => {
    expect(d('5x', '3x + 2')).toBe('unlike-added');
    expect(d('5x^3', '2x^2 + 3x')).toBe('unlike-added');
    expect(d('5x^3 - 3', '3x^2 + 2x - 3')).toBe('unlike-added');
    expect(d('x^2 + 3', '2x + 3')).toBe('x-plus-x-is-x2');
    expect(d('4x^2 - 3', '3x^2 + 2x - 3')).toBe('x-plus-x-is-x2');
    expect(d('x^3', '3x')).toBe('x-plus-x-is-x2');
    expect(d('x^2 + x + 2', 'x^2 + x - 2')).toBe('sign');
    expect(d('5', '-5')).toBe('sign');
  });

  it('falls back to too-big/too-small for numbers and wrong-<kind> otherwise', () => {
    expect(d('28', '11')).toBe('too-big');
    expect(d('3', '11')).toBe('too-small');
    expect(d('3x + 3', '2x + 3')).toBe('wrong-x');
    expect(d('2x^2 + 2x - 3', '3x^2 + 2x - 3')).toBe('wrong-x2');
    expect(d('2x + 4', '2x + 3')).toBe('wrong-1');
    expect(d('xy', '2xy + 1')).toBe('wrong-xy');
    expect(d('2x + 3', '3 + 2x')).toBe('ok');
  });
});

describe('algebra check: the mat', () => {
  it('compares the mat with the target', () => {
    expect(code({ expr: '2x + 3' }, { mat: tilesOf('x + 3 + x') })).toBe('ok');
    expect(code({ expr: '2x + 3' }, { mat: [] })).toBe('empty');
    expect(code({ expr: '2x + 3' }, { mat: tilesOf('5x') })).toBe('unlike-added');
    expect(code({ expr: '2x + 3', traps: [{ expr: '3x + 2', code: 'swapped' }] }, { mat: tilesOf('3x + 2') })).toBe('swapped');
    expect(code({ expr: '2x + 3', traps: [{ write: '3x + 2', code: 'swapped' }] }, { mat: tilesOf('3x + 2') })).toBe('wrong-x');
  });

  it('simplified: no zero pairs left on the mat', () => {
    const mat = tilesOf('x^2 + x + 1 - 3');
    expect(code({ expr: 'x^2 + x - 2' }, { mat })).toBe('ok');
    expect(code({ expr: 'x^2 + x - 2', simplified: true }, { mat })).toBe('zero-pairs');
    expect(code({ expr: 'x^2 + x - 2', simplified: 'written' }, { mat })).toBe('ok');
    expect(code({ expr: 'x^2 + x - 2', simplified: true }, { mat: tilesOf('x^2 + x - 2') })).toBe('ok');
  });

  it('fails with empty when there is no state', () => {
    expect(checkAlgebra({ type: 'algebra', expr: 'x' }, undefined)).toEqual({ ok: false, code: 'empty' });
  });
});

describe('algebra check: the written answer', () => {
  const c: Omit<AlgebraCheck, 'type'> = {
    written: '3x^2 + 2x - 3',
    simplified: true,
    traps: [{ write: '3x^2 + 4x - 3', code: 'minus-ignored' }, { write: '3x^2 + 3x - 4', code: 'different-shapes' }],
  };
  it('checks value, traps, slips and collecting', () => {
    expect(code(c, { written: '3x^2+2x-3' })).toBe('ok');
    expect(code(c, { written: '-3 + 2x + 3x^2' })).toBe('ok');
    expect(code(c, { written: null })).toBe('empty');
    expect(code(c, { written: ' ' })).toBe('empty');
    expect(code(c, { written: '3x^2+' })).toBe('syntax');
    expect(code(c, { written: '3x^2 + 4x - 3' })).toBe('minus-ignored');
    expect(code(c, { written: '3x^2+3x-4' })).toBe('different-shapes');
    expect(code(c, { written: '5x^3-3' })).toBe('unlike-added');
    expect(code(c, { written: '2x^2 + x^2 + 2x - 3' })).toBe('not-simplified');
    expect(code({ ...c, simplified: 'mat' }, { written: '2x^2 + x^2 + 2x - 3' })).toBe('ok');
  });

  it('checks a number from substitution', () => {
    const n = { written: '11', traps: [{ write: '28', code: 'joined-digits' }] };
    expect(code(n, { written: '11' })).toBe('ok');
    expect(code(n, { written: '۱۱' })).toBe('ok');
    expect(code(n, { written: '28' })).toBe('joined-digits');
    expect(code(n, { written: '12' })).toBe('too-big');
    expect(code({ written: '-5', simplified: true }, { written: '4-9' })).toBe('not-simplified');
    expect(code({ written: '-5' }, { written: '−5' })).toBe('ok');
  });

  it('tests the mat before the written answer', () => {
    expect(code({ expr: 'x + 1', written: 'x + 1' }, { mat: tilesOf('x'), written: 'x + 1' })).toBe('wrong-1');
    expect(code({ expr: 'x + 1', written: 'x + 1' }, { mat: tilesOf('x + 1'), written: 'x' })).toBe('wrong-1');
  });
});

describe('algebra check: rectangle', () => {
  it('cells: every block holds the right tile', () => {
    expect(code({ rectangle: { cells: true } }, { blocks: [{ tile: 'x', want: 'x' }, { tile: '1', want: '1' }] })).toBe('ok');
    expect(code({ rectangle: { cells: true } }, { blocks: [{ tile: 'x', want: 'x' }, { tile: null, want: '1' }] })).toBe('cells-empty');
    expect(code({ rectangle: { cells: true } }, { blocks: [{ tile: 'x^2', want: 'x' }] })).toBe('wrong-cell');
    expect(code({ rectangle: { cells: true } }, { blocks: [] })).toBe('cells-empty');
  });

  it('sides: factorising the given tiles, fully', () => {
    const r = { rectangle: { sides: ['x + 2', 'x + 3'] as [string, string] } };
    expect(code(r, { sides: ['x + 3', 'x + 2'], given: 'x^2 + 5x + 6' })).toBe('ok');
    expect(code(r, { sides: null, given: 'x^2 + 5x + 6' })).toBe('empty');
    expect(code(r, { sides: ['x + 6', 'x + 1'], given: 'x^2 + 5x + 6' })).toBe('not-given');
    expect(code({ ...r, traps: [{ sides: ['x + 1', 'x + 6'], code: 'sum-not-product' }] }, { sides: ['x + 6', 'x + 1'], given: 'x^2 + 5x + 6' })).toBe('sum-not-product');
    const p = { rectangle: { sides: ['4', '3x + 2'] as [string, string] } };
    expect(code(p, { sides: ['2', '6x + 4'], given: '12x + 8' })).toBe('partial-factor');
    expect(code(p, { sides: ['4', '3x + 2'], given: '12x + 8' })).toBe('ok');
    expect(code({ rectangle: { sides: ['3', 'x + 4'] } }, { sides: ['4', 'x + 3'] })).toBe('wrong-sides');
  });

  it('missing: the corner tiles that complete the square', () => {
    const r = { rectangle: { sides: ['x + 3', 'x + 3'] as [string, string], missing: '9' } };
    expect(code(r, { sides: ['x + 3', 'x + 3'], given: 'x^2 + 6x' })).toBe('ok');
    expect(code(r, { sides: ['x + 6', 'x'], given: 'x^2 + 6x' })).toBe('not-given');
  });
});

describe('algebra check: grid', () => {
  const s = { rows: ['x', '3'], cols: ['x', '2'], cells: [['x^2', '2x'], ['3x', '6']] };
  it('cells: row × column', () => {
    expect(code({ grid: { cells: true } }, s)).toBe('ok');
    expect(code({ grid: { cells: true, rows: ['x', '3'] } }, s)).toBe('ok');
    expect(code({ grid: { cells: true, rows: ['x', '2'] } }, s)).toBe('wrong-header');
    expect(code({ grid: { cells: true } }, { ...s, rows: ['x', null] })).toBe('headers-empty');
    expect(code({ grid: { cells: true } }, {})).toBe('headers-empty');
    expect(code({ grid: { cells: true } }, { ...s, cells: [['x^2', '2x'], ['3x', null]] })).toBe('cells-empty');
    expect(code({ grid: { cells: true } }, { ...s, cells: [['2x', '2x'], ['3x', '6']] })).toBe('added-not-multiplied');
    expect(code({ grid: { cells: true } }, { ...s, cells: [['x^2', '2x'], ['3x', '5']] })).toBe('added-not-multiplied');
    expect(code({ grid: { cells: true } }, { ...s, cells: [['x^2', '2x'], ['3x', '7']] })).toBe('wrong-cell');
  });

  it('divide: the cells add up to the total, with the remainder', () => {
    const t = { rows: ['x', '1'], cols: ['x', '2'], cells: [['x^2', '2x'], ['x', '2']], total: 'x^2 + 3x + 5' };
    expect(code({ grid: { cells: true, remainder: '3' } }, { ...t, remainder: '3' })).toBe('ok');
    expect(code({ grid: { cells: true, remainder: '3' } }, { ...t, remainder: null })).toBe('remainder-empty');
    expect(code({ grid: { cells: true } }, { ...t, remainder: '4' })).toBe('wrong-total');
    expect(code({ grid: { cells: true } }, { ...t, total: 'x^2 + 3x + 2', remainder: null })).toBe('ok');
  });
});
