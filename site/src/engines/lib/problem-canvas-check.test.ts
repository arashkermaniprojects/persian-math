import { describe, expect, it } from 'vitest';
import { checkCanvas, type CanvasCheck } from './problem-canvas-check';
import type { CanvasState, ToolState } from './problem-canvas-model';

const state = (s: Partial<CanvasState>): CanvasState => ({ known: [], asked: null, strategy: null, tools: [], answer: null, ...s });
const code = (c: Omit<CanvasCheck, 'type'>, s: Partial<CanvasState>, typed?: number | null) => {
  const r = checkCanvas({ type: 'problem-canvas', ...c }, state(s), typed);
  return r.ok ? 'ok' : r.code;
};
const bar = (whole: number | '?' | null, parts: (number | '?' | null)[]): ToolState => ({ kind: 'bar', model: 'part-whole', whole, parts });

describe('understand the problem', () => {
  const c = { known: ['books', 'story'], asked: 'science' };
  it('needs every needed fact, no distractor, and the right question', () => {
    expect(code(c, { known: ['books'], asked: 'science' })).toBe('known-missing');
    expect(code(c, { known: ['books', 'story', 'shelf'], asked: 'science' })).toBe('known-extra');
    expect(code(c, { known: ['story', 'books'] })).toBe('asked-empty');
    expect(code(c, { known: ['story', 'books'], asked: 'all' })).toBe('asked-wrong');
    expect(code(c, { known: ['story', 'books'], asked: 'science' })).toBe('ok');
  });
});

describe('strategy', () => {
  it('accepts one or several strategies', () => {
    expect(code({ strategy: 'draw' }, {})).toBe('strategy-empty');
    expect(code({ strategy: 'draw' }, { strategy: 'guess' })).toBe('strategy-wrong');
    expect(code({ strategy: ['draw', 'symbolic'] }, { strategy: 'symbolic' })).toBe('ok');
  });
  it('a tool hidden by the chosen strategy cannot pass its check', () => {
    const tools: ToolState[] = [{ ...bar(23, [12, '?']), shown: false }];
    expect(code({ bar: { whole: 23, parts: [12, '?'] } }, { tools })).toBe('strategy-wrong');
  });
});

describe('bar model', () => {
  const c = { bar: { whole: 23, parts: [12, '?'] as (number | '?')[] } };
  it('part-whole: whole and parts in any order', () => {
    expect(code(c, { tools: [bar(null, [null, null])] })).toBe('bar-empty');
    expect(code(c, { tools: [bar(12, [23, '?'])] })).toBe('bar-whole');
    expect(code(c, { tools: [bar(23, [12, 11])] })).toBe('bar-parts');
    expect(code(c, { tools: [bar(23, [12, '?', null])] })).toBe('bar-count');
    expect(code(c, { tools: [bar(23, ['?', 12])] })).toBe('ok');
    expect(code({ bar: { ...c.bar, anyOrder: false } }, { tools: [bar(23, ['?', 12])] })).toBe('bar-parts');
  });
  it('the whole can be the unknown (join stories)', () => {
    expect(code({ bar: { whole: '?', parts: [5, 3] } }, { tools: [bar('?', [3, 5])] })).toBe('ok');
    expect(code({ bar: { whole: '?', parts: [5, 3] } }, { tools: [bar(8, [3, 5])] })).toBe('bar-whole');
  });
  it('compare: who has more, both rows and the difference', () => {
    const cmp = (more: 0 | 1, a: number | '?' | null, b: number | '?' | null, d: number | '?' | null): ToolState =>
      ({ kind: 'bar', model: 'compare', whole: null, parts: [a, b], d, more });
    const c2 = { bar: { parts: [14, '?'] as (number | '?')[], d: 6, more: 0 as const } };
    expect(code(c2, { tools: [cmp(1, 14, '?', 6)] })).toBe('bar-more');
    expect(code(c2, { tools: [cmp(0, 14, 6, '?')] })).toBe('bar-parts');
    expect(code(c2, { tools: [cmp(0, 14, '?', '?')] })).toBe('bar-diff');
    expect(code(c2, { tools: [cmp(0, 14, '?', 6)] })).toBe('ok');
  });
  it('several bars are checked in order; null skips one', () => {
    const tools = [bar(10, [4, 6]), bar(23, [12, '?'])];
    expect(code({ bar: [null, c.bar] }, { tools })).toBe('ok');
    expect(code({ bar: [c.bar, null] }, { tools })).toBe('bar-whole');
  });
});

describe('table', () => {
  const t = (rows: (number | null)[][]): ToolState => ({ kind: 'table', cols: ['a', 'b', 'p'], rows });
  it('cells', () => {
    const c = { table: { cells: [[1, 1, 12]] as [number, number, number][] } };
    expect(code(c, { tools: [t([[null, null, null]])] })).toBe('table-empty');
    expect(code(c, { tools: [t([[1, 24, 24], [2, null, null]])] })).toBe('table-empty');
    expect(code(c, { tools: [t([[1, 24, 24], [2, 13, 26]])] })).toBe('table-wrong');
    expect(code(c, { tools: [t([[1, 24, 24], [2, 12, 24]])] })).toBe('ok');
  });
  it('follow: filled cells continue the pattern of the given rows', () => {
    const c = { table: { follow: 1, given: 4 } };
    const rows = (xs: (number | null)[]) => xs.map((x, i) => [i + 1, x, null]);
    expect(code(c, { tools: [t(rows([1, 3, 6, 10, 15, 21]))] })).toBe('ok');
    expect(code(c, { tools: [t(rows([1, 3, 6, 10, 14, 18]))] })).toBe('table-pattern');
  });
  it('systematic list: every possibility once, in any row order', () => {
    const c = { table: { list: [[1, 24], [2, 12], [3, 8], [4, 6]], cols: [0, 1] } };
    const ok = [[3, 8, 24], [1, 24, 24], [4, 6, 24], [2, 12, 24]];
    expect(code(c, { tools: [t(ok)] })).toBe('ok');
    expect(code(c, { tools: [t([...ok.slice(0, 3), [null, null, null]])] })).toBe('list-missing');
    expect(code(c, { tools: [t([...ok, [2, 12, 24]])] })).toBe('list-repeat');
    expect(code(c, { tools: [t([...ok, [5, 5, 25]])] })).toBe('list-wrong');
    expect(code(c, { tools: [t([[24, 1, 24], [12, 2, 24], [8, 3, 24], [6, 4, 24]])] })).toBe('list-wrong');
    expect(code({ table: { ...c.table, anyOrder: true } }, { tools: [t([[24, 1, 24], [12, 2, 24], [8, 3, 24], [6, 4, 24]])] })).toBe('ok');
  });
});

describe('guess and check', () => {
  const g = (cmps: (-1 | 0 | 1)[]): ToolState => ({ kind: 'guess', guesses: cmps.map((cmp, i) => ({ x: i, v: [], cmp })), found: cmps.includes(0) });
  it('needs a guess, then a hit', () => {
    expect(code({ guess: {} }, { tools: [g([])] })).toBe('no-guess');
    expect(code({ guess: {} }, { tools: [g([1, -1])] })).toBe('not-found');
    expect(code({ guess: {} }, { tools: [g([1, -1, 0])] })).toBe('ok');
    expect(code({ guess: { found: false } }, { tools: [g([1])] })).toBe('ok');
  });
});

describe('eliminate', () => {
  const l = (crossed: number[]): ToolState => ({ kind: 'list', items: [12, 15, 18, 'red'], crossed });
  it('keeps the answer and crosses out the rest', () => {
    expect(code({ list: { keep: [18] } }, { tools: [l([0, 2])] })).toBe('crossed-answer');
    expect(code({ list: { keep: [18] } }, { tools: [l([0])] })).toBe('too-many-left');
    expect(code({ list: { keep: [18] } }, { tools: [l([0, 1, 3])] })).toBe('ok');
    expect(code({ list: { keep: ['red'] } }, { tools: [l([0, 1, 2])] })).toBe('ok');
  });
});

describe('number sentence', () => {
  const s = (tokens: (string | null)[], solved: number | null = null): ToolState => ({ kind: 'sentence', tokens, solved });
  const c = { sentence: { box: 11, uses: [23, 12] } };
  it('any true sentence with the story numbers and one box', () => {
    expect(code(c, { tools: [s(['23', '-', null, '=', '?'])] })).toBe('sentence-empty');
    expect(code(c, { tools: [s(['23', '-', '12', '=', '11'])] })).toBe('sentence-box');
    expect(code(c, { tools: [s(['23', '-', '?', '=', '?'])] })).toBe('sentence-box');
    expect(code(c, { tools: [s(['23', '-', '11', '=', '?'])] })).toBe('sentence-numbers');
    expect(code(c, { tools: [s(['23', '+', '12', '=', '?'])] })).toBe('sentence-false');
    expect(code(c, { tools: [s(['12', '+', '?', '=', '23'])] })).toBe('ok');
    expect(code(c, { tools: [s(['23', '-', '12', '=', '?'])] })).toBe('ok');
  });
  it('a repeated number must appear twice', () => {
    const c2 = { sentence: { box: 10, uses: [5, 5] } };
    expect(code(c2, { tools: [s(['5', '+', '?', '=', '10'])] })).toBe('sentence-numbers');
    expect(code(c2, { tools: [s(['5', '+', '5', '=', '?'])] })).toBe('ok');
  });
  it('solve: the box is also worked out (sub-problems)', () => {
    const c3 = { sentence: [{ box: 15, solve: true }, { box: 5, uses: [15], solve: true }] };
    const first = s(['3', '×', '5', '=', '?'], 15);
    expect(code(c3, { tools: [s(['3', '×', '5', '=', '?']), s(['15', '-', '10', '=', '?'], 5)] })).toBe('solve-empty');
    expect(code(c3, { tools: [first, s(['15', '-', '10', '=', '?'], 6)] })).toBe('solve-wrong');
    expect(code(c3, { tools: [first, s(['15', '-', '10', '=', '?'], 5)] })).toBe('ok');
  });
});

describe('answer', () => {
  const c = { answer: 11, traps: [{ value: 35, code: 'added' }] };
  it('checks the number, with traps and size codes', () => {
    expect(code(c, {})).toBe('empty');
    expect(code(c, { answer: 35 })).toBe('added');
    expect(code(c, { answer: 12 })).toBe('too-big');
    expect(code(c, { answer: 10 })).toBe('too-small');
    expect(code(c, { answer: 11 })).toBe('ok');
  });
  it('falls back to a number typed in the studio answer box', () => {
    expect(code(c, {}, 11)).toBe('ok');
    expect(code(c, {}, 35)).toBe('added');
  });
  it('is checked after the drawing', () => {
    expect(code({ ...c, bar: { whole: 23, parts: [12, '?'] } }, { tools: [bar(12, [23, '?'])], answer: 11 })).toBe('bar-whole');
  });
  it('passes an empty check and copes with no state', () => {
    expect(checkCanvas({ type: 'problem-canvas' }, undefined)).toEqual({ ok: true });
    expect(checkCanvas({ type: 'problem-canvas', answer: 3 }, undefined)).toEqual({ ok: false, code: 'empty' });
  });
});
