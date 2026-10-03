import { describe, expect, it } from 'vitest';
import { evaluate } from './checks';
import { Frac } from './fraction';

describe('evaluate', () => {
  it('shaded-equals accepts equivalent shading unless exact', () => {
    const check = { type: 'shaded-equals', value: [3, 4] } as const;
    expect(evaluate(check, { state: { bars: [{ parts: 8, shaded: 6 }] } })).toEqual({ ok: true });
    expect(evaluate({ ...check, exact: true }, { state: { bars: [{ parts: 8, shaded: 6 }] } }).code).toBe('wrong-denominator');
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 2 }] } }).code).toBe('too-small');
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 0 }] } }).code).toBe('empty');
  });

  it('shaded-equals treats several bars as one quantity', () => {
    const check = { type: 'shaded-equals', value: [5, 4] } as const;
    const state = { bars: [{ parts: 4, shaded: 4 }, { parts: 4, shaded: 1 }] };
    expect(evaluate(check, { state }).ok).toBe(true);
  });

  it('shaded-equals can check a single bar and ignore a reference bar', () => {
    const check = { type: 'shaded-equals', value: [1, 2], bar: 1 } as const;
    const state = { bars: [{ parts: 4, shaded: 2 }, { parts: 8, shaded: 4 }] };
    expect(evaluate(check, { state }).ok).toBe(true);
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 2 }, { parts: 8, shaded: 2 }] } }).code).toBe('too-small');
    expect(evaluate(check, { state: { bars: [{ parts: 4, shaded: 2 }, { parts: 8, shaded: 0 }] } }).code).toBe('empty');
    expect(evaluate({ type: 'shaded-equals', value: [2, 6], exact: true, bar: 1 }, { state: { bars: [{ parts: 3, shaded: 1 }, { parts: 9, shaded: 3 }] } }).code).toBe('wrong-denominator');
    expect(evaluate({ ...check, bar: 5 }, { state }).code).toBe('empty');
  });

  it('answer-equals checks value, denominator and simplest form', () => {
    const check = { type: 'answer-equals', value: [1, 2], simplest: true } as const;
    expect(evaluate(check, { fraction: { n: 1, d: 2 } }).ok).toBe(true);
    expect(evaluate(check, { fraction: { n: 2, d: 4 } }).code).toBe('not-simplest');
    expect(evaluate(check, { fraction: { n: 2, d: 3 } }).code).toBe('too-big');
    expect(evaluate(check, { fraction: { n: 1, d: 0 } }).code).toBe('zero-denominator');
    expect(evaluate({ type: 'answer-equals', value: [3, 4], denominator: 8 }, { fraction: { n: 3, d: 4 } }).code).toBe('wrong-denominator');
  });

  it('point-equals needs every target point', () => {
    const check = { type: 'point-equals', values: [[1, 3], [2, 3]] } as const;
    expect(evaluate(check, { state: { points: [[2, 3], [1, 3]] } }).ok).toBe(true);
    expect(evaluate(check, { state: { points: [[1, 3]] } }).code).toBe('count');
    expect(evaluate({ type: 'point-equals', values: [[1, 2]] }, { state: { points: [[3, 4]] } }).code).toBe('too-big');
  });

  it('point-equals gives a trap code for a known wrong set of points', () => {
    const add = { type: 'point-equals', values: [[-7, 1]], traps: [{ values: [[7, 1]], code: 'two-minuses' }] } as const;
    expect(evaluate(add, { state: { points: [[7, 1]] } }).code).toBe('two-minuses');
    expect(evaluate(add, { state: { points: [[6, 1]] } }).code).toBe('too-big');
    expect(evaluate(add, { state: { points: [[-14, 2]] } }).ok).toBe(true);
    const hops = { type: 'point-equals', values: [[-2, 1], [-4, 1], [-6, 1]], traps: [{ values: [[2, 1], [4, 1], [6, 1]], code: 'sign' }] } as const;
    expect(evaluate(hops, { state: { points: [[6, 1], [2, 1], [4, 1]] } }).code).toBe('sign');
    expect(evaluate(hops, { state: { points: [[2, 1], [4, 1], [4, 1]] } }).code).toBe('wrong');
  });

  it('answer-decimal compares exactly', () => {
    const check = { type: 'answer-decimal', value: '0.3' } as const;
    expect(evaluate(check, { decimal: new Frac(3, 10) }).ok).toBe(true);
    expect(evaluate(check, { decimal: new Frac(1, 3) }).code).toBe('too-big');
    expect(evaluate(check, { decimal: null }).code).toBe('empty');
  });

  it('choice and integer answers', () => {
    expect(evaluate({ type: 'choice', options: ['a', 'b'], correct: 1 }, { choice: 1 }).ok).toBe(true);
    const pick = { type: 'choice', options: ['a', 'b', 'c'], correct: 1, traps: [{ choice: 2, code: 'goes-on' }] } as const;
    expect(evaluate(pick, { choice: 2 }).code).toBe('goes-on');
    expect(evaluate(pick, { choice: 0 }).code).toBe('wrong');
    expect(evaluate({ type: 'answer-integer', value: 12 }, { integer: 9 }).code).toBe('too-small');
  });

  it('answer-equals gives a trap code for a known wrong answer and can require a mixed number', () => {
    const sub = { type: 'answer-equals', value: [5, 12], traps: [{ value: [2, 1], code: 'tops-and-bottoms' }] } as const;
    expect(evaluate(sub, { fraction: { n: 2, d: 1 } }).code).toBe('tops-and-bottoms');
    expect(evaluate(sub, { fraction: { n: 4, d: 2 } }).code).toBe('tops-and-bottoms');
    expect(evaluate(sub, { fraction: { n: 1, d: 2 } }).code).toBe('too-big');
    expect(evaluate(sub, { fraction: { n: 5, d: 12 } }).ok).toBe(true);
    const mixed = { type: 'answer-equals', value: [9, 4], mixed: true } as const;
    expect(evaluate(mixed, { fraction: { whole: 2, n: 1, d: 4 } }).ok).toBe(true);
    expect(evaluate(mixed, { fraction: { n: 9, d: 4 } }).code).toBe('not-mixed');
    expect(evaluate(mixed, { fraction: { whole: 1, n: 5, d: 4 } }).code).toBe('not-mixed');
    expect(evaluate(mixed, { fraction: { whole: 1, n: 1, d: 4 } }).code).toBe('too-small');
  });

  it('answer-integer gives a trap code for a known wrong number', () => {
    const c = { type: 'answer-integer', value: 47, traps: [{ value: 74, code: 'reversed' }] } as const;
    expect(evaluate(c, { integer: 74 }).code).toBe('reversed');
    expect(evaluate(c, { integer: 48 }).code).toBe('too-big');
    expect(evaluate(c, { integer: 47 }).ok).toBe(true);
  });

  it('place-value checks the number shown and whether it is exchanged', () => {
    const c = { type: 'place-value', value: 14, canonical: true } as const;
    expect(evaluate(c, { state: { value: '14', counts: [14, 0] } }).code).toBe('needs-exchange');
    expect(evaluate(c, { state: { value: '14', counts: [4, 1] } }).ok).toBe(true);
    expect(evaluate(c, { state: { value: '41', counts: [1, 4] } }).code).toBe('too-big');
  });
});

describe('facts-correct (<kg-fact-fluency>)', () => {
  it('passes when enough facts are right first time, else says keep going or play again', () => {
    const c = { type: 'facts-correct' as const, min: 8 };
    expect(evaluate(c, { state: {} }).code).toBe('empty');
    expect(evaluate(c, { state: { total: 10, answered: 4, correct: 4, done: false } }).code).toBe('not-finished');
    expect(evaluate(c, { state: { total: 10, answered: 10, correct: 6, done: true } }).code).toBe('too-few');
    expect(evaluate(c, { state: { total: 10, answered: 9, correct: 8, done: false } }).ok).toBe(true);
  });
});

describe('measure (<kg-measure>)', () => {
  it('checks the typed (integer or decimal) or measured value, and lining up from zero', () => {
    const c = { type: 'measure' as const, value: 7, aligned: true };
    expect(evaluate(c, { state: { tool: 'ruler', aligned: true }, integer: 7 }).ok).toBe(true);
    expect(evaluate(c, { state: { tool: 'ruler', aligned: false, misreads: [[5, 'not-from-zero']] }, integer: 5 }).code).toBe('not-from-zero');
    expect(evaluate({ type: 'measure', value: 6.4 }, { state: { tool: 'ruler' }, decimal: new Frac(32, 5) }).ok).toBe(true);
    expect(evaluate({ type: 'measure', value: 600 }, { state: { tool: 'balance', measured: 500 }, integer: null }).code).toBe('too-small');
  });
});

describe('chart (<kg-chart-builder>)', () => {
  it('checks tallies, typed counts and chart values from the engine state', () => {
    const c = { type: 'chart' as const, tally: [6, 3], values: [6, 3] };
    expect(evaluate(c, { state: { tally: [6, 3], values: [6, 3], unit: 2 } }).ok).toBe(true);
    expect(evaluate(c, { state: { tally: [6, 3], values: [12, 6], unit: 2 } }).code).toBe('key-ignored');
    expect(evaluate({ type: 'chart', typed: [7] }, { state: { typed: [6] } }).code).toBe('gate-as-four');
    expect(evaluate({ type: 'chart', pick: 'apple' }, { state: { cat: 'apple' } }).ok).toBe(true);
  });
});

describe('chance (probability-sim)', () => {
  it('reads the nested engine state', () => {
    const chance = { probs: { red: [1, 1] as [number, number] }, chosen: 'red', trials: 10 };
    expect(evaluate({ type: 'chance', prob: { outcomes: ['red'], level: 'certain' }, chosen: 'red', trials: 10 }, { state: { chance } })).toEqual({ ok: true });
    expect(evaluate({ type: 'chance', chosen: 'blue' }, { state: { chance } }).code).toBe('choose-wrong');
    expect(evaluate({ type: 'chance', space: true }, {}).code).toBe('space-empty');
  });
});

describe('shape-board (<kg-shape-board>)', () => {
  it('reads the nested board state', () => {
    const board = { drawn: [{ kind: 'polygon' as const, pts: [[0, 0], [3, 0], [3, 2], [0, 2]] as [number, number][], closed: true }] };
    expect(evaluate({ type: 'shape-board', shape: 'rectangle', area: 6 }, { state: { board } }).ok).toBe(true);
    expect(evaluate({ type: 'shape-board', shape: 'square', traps: [{ shape: 'rectangle', code: 'not-equal' }] }, { state: { board } }).code).toBe('not-equal');
    expect(evaluate({ type: 'shape-board', shape: 'triangle' }, {}).code).toBe('empty');
  });
});

describe('problem-canvas (<kg-problem-canvas>)', () => {
  it('reads the engine state, falling back to the studio answer box', () => {
    const tools = [{ kind: 'bar' as const, model: 'part-whole' as const, whole: 23, parts: [12, '?' as const] }];
    const state = { known: ['books', 'story'], asked: 'science', strategy: null, tools, answer: 11 };
    const check = { type: 'problem-canvas', known: ['books', 'story'], bar: { whole: 23, parts: [12, '?'] }, answer: 11 } as const;
    expect(evaluate(check, { state })).toEqual({ ok: true });
    expect(evaluate({ ...check, answer: 12 }, { state }).code).toBe('too-small');
    expect(evaluate({ type: 'problem-canvas', answer: 11, traps: [{ value: 35, code: 'added' }] }, { integer: 35 }).code).toBe('added');
    expect(evaluate({ type: 'problem-canvas', known: ['a'] }, {}).code).toBe('known-missing');
  });
});

describe('pattern check (kg-pattern-machine)', () => {
  it('routes to the pattern-machine check and its reason codes', () => {
    const state = { pattern: { mode: 'grow', answers: { t4: 13, t10: 40 }, expect: { t4: 13, t10: 31 } } };
    expect(evaluate({ type: 'pattern', answers: true }, { state }).code).toBe('too-big');
    expect(evaluate({ type: 'pattern', answers: true, traps: [{ key: 't10', value: 40, code: 'four-each' }] }, { state }).code).toBe('four-each');
    const seq = { pattern: { mode: 'repeat', seq: ['a', 'b'], target: ['a', 'b'] } };
    expect(evaluate({ type: 'pattern', complete: true }, { state: seq }).ok).toBe(true);
    expect(evaluate({ type: 'pattern', expr: true }, {}).code).toBe('empty');
  });
});

describe('coord check (kg-coord-plane)', () => {
  it('routes to the coord-plane check and its reason codes', () => {
    const state = { plane: { lines: [{ m: 2, c: 4 }], scale: [1, 1] as [number, number] } };
    expect(evaluate({ type: 'coord', line: { m: -2, c: 4 } }, { state }).code).toBe('sign');
    expect(evaluate({ type: 'coord', line: { m: 2, c: 4 } }, { state }).ok).toBe(true);
    expect(evaluate({ type: 'coord', points: [[1, 1]] }, {}).code).toBe('empty');
  });
});

describe('solid check (kg-solid-viewer)', () => {
  it('routes to the solid-viewer check: picks, layers, then the typed value and its unit', () => {
    const solid = { picked: [0, 2], roles: ['base', 'lateral'], bases: 2, layers: 6, full: 6, answer: { value: 36, unit: 'cm2' }, misreads: [[72, 'wrong-base']] as [number, string][] };
    expect(evaluate({ type: 'solid', pick: 'bases' }, { state: { solid } }).code).toBe('wrong-base');
    expect(evaluate({ type: 'solid', layers: 'full', volume: 36, unit: 'cm3' }, { state: { solid } }).code).toBe('area-for-volume');
    expect(evaluate({ type: 'solid', volume: 36, unit: 'cm3' }, { state: { solid: { ...solid, answer: { value: 72, unit: 'cm3' } } } }).code).toBe('wrong-base');
    expect(evaluate({ type: 'solid', volume: 36, unit: 'cm3' }, { state: { solid: { ...solid, answer: { value: 36, unit: 'cm3' } } } }).ok).toBe(true);
    expect(evaluate({ type: 'solid', area: 94 }, {}).code).toBe('empty');
  });
});

describe('algebra check (kg-algebra-tiles)', () => {
  it('routes to the algebra-tiles check and its reason codes', () => {
    const mat = [{ kind: 'x', sign: 1 as const }, { kind: 'x', sign: 1 as const }, { kind: '1', sign: 1 as const }];
    expect(evaluate({ type: 'algebra', expr: '2x + 1' }, { state: { algebra: { mode: 'tiles', mat } } })).toEqual({ ok: true });
    expect(evaluate({ type: 'algebra', expr: '2x + 3' }, { state: { algebra: { mode: 'tiles', mat } } }).code).toBe('wrong-1');
    expect(evaluate({ type: 'algebra', written: '11', traps: [{ write: '28', code: 'joined-digits' }] }, { state: { algebra: { mode: 'tiles', written: '28' } } }).code).toBe('joined-digits');
    expect(evaluate({ type: 'algebra', written: 'x' }, {}).code).toBe('empty');
  });
});

describe('summary check (kg-chart-builder summary module)', () => {
  it('routes to the summary check and its reason codes', () => {
    const summary = { sets: [{ key: 'a', given: [7, 3, 9], data: [7, 3, 9], line: [3, 7, 9], marked: [7] }], typed: { range: 9 }, best: null, compare: {} };
    expect(evaluate({ type: 'summary', ordered: true, marked: 'middle' }, { state: { summary } })).toEqual({ ok: true });
    expect(evaluate({ type: 'summary', range: 6 }, { state: { summary } }).code).toBe('range-is-max');
    expect(evaluate({ type: 'summary', median: 7 }, {}).code).toBe('empty');
  });
});
