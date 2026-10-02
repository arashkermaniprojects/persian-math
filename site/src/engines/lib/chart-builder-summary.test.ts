import { describe, expect, it } from 'vitest';
import { checkSummary, isOrdered, mad, mean, median, middles, modes, range, type SummarySet, type SummaryState } from './chart-builder-summary';

const ok = { ok: true };
const set = (given: number[], o: Partial<SummarySet> = {}): SummarySet => ({ key: 'a', given, data: given.slice(), marked: [], ...o });
const st = (sets: SummarySet[], o: Partial<SummaryState> = {}): SummaryState => ({ sets, typed: {}, best: null, compare: {}, ...o });

describe('summary statistics', () => {
  it('works out the averages and the spread', () => {
    expect(middles([7, 3, 9, 5, 7])).toEqual([7]);
    expect(middles([4, 9, 6, 7, 3, 8])).toEqual([6, 7]);
    expect(median([4, 9, 6, 7, 3, 8])).toBe(6.5);
    expect(mean([4, 6, 6, 7, 7])).toBe(6);
    expect(range([36, 41, 38])).toBe(5);
    expect(modes([38, 37, 38, 39, 38, 37])).toEqual([38]);
    expect(modes([1, 1, 2, 2, 3])).toEqual([1, 2]);
    expect(modes([1, 2, 3])).toEqual([]);
    expect(mad([2, 4, 6, 8])).toBe(2);
    expect(mad([5, 5, 5])).toBe(0);
  });
  it('accepts a line-up in order either way', () => {
    expect(isOrdered([3, 5, 5, 9])).toBe(true);
    expect(isOrdered([9, 5, 5, 3])).toBe(true);
    expect(isOrdered([3, 9, 5])).toBe(false);
  });
});

describe('checkSummary: line-up and marks', () => {
  const given = [7, 3, 9, 5, 8, 6, 4];
  const check = { type: 'summary', ordered: true, marked: 'middle' } as const;
  it('passes when the cards are in order and the middle card is marked', () => {
    expect(checkSummary(check, st([set(given, { line: [3, 4, 5, 6, 7, 8, 9], marked: [6] })]))).toEqual(ok);
    expect(checkSummary(check, st([set(given, { line: [9, 8, 7, 6, 5, 4, 3], marked: [6] })]))).toEqual(ok);
  });
  it('names the classic slips', () => {
    expect(checkSummary(check, undefined).code).toBe('empty');
    expect(checkSummary(check, st([set(given, { line: given })])).code).toBe('not-ordered');
    expect(checkSummary(check, st([set(given, { line: given, marked: [5] })])).code).toBe('unordered-median');
    expect(checkSummary(check, st([set(given, { line: [3, 4, 5, 6, 7, 8, 9] })])).code).toBe('mark-empty');
    expect(checkSummary(check, st([set(given, { line: [3, 4, 5, 6, 7, 8, 9], marked: [5] })])).code).toBe('not-middle');
  });
  it('wants both middle cards of an even count', () => {
    const even = [4, 9, 6, 7, 3, 8];
    const line = [3, 4, 6, 7, 8, 9];
    expect(checkSummary(check, st([set(even, { line, marked: [6, 7] })]))).toEqual(ok);
    expect(checkSummary(check, st([set(even, { line, marked: [6] })])).code).toBe('even-middle');
    expect(checkSummary(check, st([set(even, { line, marked: [7] })])).code).toBe('even-middle');
    expect(checkSummary(check, st([set(even, { line, marked: [4, 7] })])).code).toBe('not-middle');
    // two equal middle values: one stack marked is enough
    expect(checkSummary(check, st([set([1, 5, 5, 9], { line: [1, 5, 5, 9], marked: [5] })]))).toEqual(ok);
  });
  it('checks marked stacks for the mode, the ends and given values', () => {
    const d = [38, 37, 38, 39, 38, 36, 41];
    expect(checkSummary({ type: 'summary', marked: 'mode' }, st([set(d, { marked: [38, 38, 38] })]))).toEqual(ok);
    expect(checkSummary({ type: 'summary', marked: 'mode' }, st([set(d, { marked: [37] })])).code).toBe('not-mode');
    expect(checkSummary({ type: 'summary', marked: 'mode' }, st([set([1, 1, 2, 2], { marked: [1] })])).code).toBe('mode-missing');
    expect(checkSummary({ type: 'summary', marked: 'ends' }, st([set(d, { marked: [36, 41] })]))).toEqual(ok);
    expect(checkSummary({ type: 'summary', marked: 'ends' }, st([set(d, { marked: [41] })])).code).toBe('one-end');
    expect(checkSummary({ type: 'summary', marked: 'ends' }, st([set(d, { marked: [36, 39] })])).code).toBe('not-ends');
    expect(checkSummary({ type: 'summary', marked: [41] }, st([set(d, { marked: [41] })]))).toEqual(ok);
    expect(checkSummary({ type: 'summary', marked: [41] }, st([set(d, { marked: [36] })])).code).toBe('marked-wrong');
    expect(checkSummary({ type: 'summary', marked: [41] }, st([set(d)])).code).toBe('mark-empty');
  });
});

describe('checkSummary: typed averages and spread', () => {
  it('diagnoses the median', () => {
    const s = set([7, 3, 9, 5, 8]);
    const c = { type: 'summary', median: 7 } as const;
    expect(checkSummary(c, st([s], { typed: { median: 7 } }))).toEqual(ok);
    expect(checkSummary(c, st([s], { typed: { median: null } })).code).toBe('empty');
    expect(checkSummary(c, st([s], { typed: { median: 9 } })).code).toBe('unordered-median');
    expect(checkSummary(c, st([s], { typed: { median: 8 } })).code).toBe('too-big');
    const e = set([3, 4, 6, 7, 8, 9]);
    expect(checkSummary({ type: 'summary', median: 6.5 }, st([e], { typed: { median: 6.5 } }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', median: 6.5 }, st([e], { typed: { median: 6 } })).code).toBe('even-middle');
    expect(checkSummary({ type: 'summary', median: 6.5 }, st([e], { typed: { median: 7 } })).code).toBe('even-middle');
  });
  it('diagnoses the mode, the range and the mean', () => {
    const s = set([38, 37, 38, 39, 38, 36, 41]);
    expect(checkSummary({ type: 'summary', mode: 38 }, st([s], { typed: { mode: 38 } }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', mode: 38 }, st([s], { typed: { mode: 3 } })).code).toBe('mode-is-frequency');
    expect(checkSummary({ type: 'summary', range: 5 }, st([s], { typed: { range: 41 } })).code).toBe('range-is-max');
    expect(checkSummary({ type: 'summary', range: 5 }, st([s], { typed: { range: 4 } })).code).toBe('too-small');
    const m = set([4, 6, 6, 7, 17]);
    expect(checkSummary({ type: 'summary', mean: 8 }, st([m], { typed: { mean: 8 } }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', mean: 8 }, st([m], { typed: { mean: 40 } })).code).toBe('total-only');
    expect(checkSummary({ type: 'summary', mean: 8 }, st([m], { typed: { mean: 6 } })).code).toBe('median-not-mean');
    expect(checkSummary({ type: 'summary', mad: 2 }, st([set([2, 4, 6, 8])], { typed: { mad: 0 } })).code).toBe('signed-deviations');
  });
  it('uses the data as it is now for `true`, and a tolerance', () => {
    const moved = set([4, 6, 6, 7, 7], { data: [4, 6, 6, 7, 17] });
    expect(checkSummary({ type: 'summary', mean: true }, st([moved], { typed: { mean: 8 } }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', mean: true }, st([moved], { typed: { mean: 6 } })).code).toBe('median-not-mean');
    expect(checkSummary({ type: 'summary', mean: true }, st([set([1, 2, 4])], { typed: { mean: 2.33 } }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', mean: true }, st([set([1, 2, 4])], { typed: { mean: 2.3 } })).code).toBe('too-small');
    expect(checkSummary({ type: 'summary', mean: true, tolerance: 0.05 }, st([set([1, 2, 4])], { typed: { mean: 2.3 } }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', mode: true }, st([set([1, 1, 2, 2])], { typed: { mode: 2 } }))).toEqual(ok);
  });
  it('requires a value to be dragged for `moved`', () => {
    const c = { type: 'summary', moved: true, mean: 8 } as const;
    expect(checkSummary(c, st([set([4, 6, 6, 7, 7])], { typed: { mean: 8 } })).code).toBe('not-moved');
    expect(checkSummary(c, st([set([4, 6, 6, 7, 7], { data: [4, 6, 6, 7, 17] })], { typed: { mean: 8 } }))).toEqual(ok);
  });
  it('checks each set when there are two, keyed by set', () => {
    const a = set([5, 6, 7], { key: 'a' }), b = set([2, 6, 10], { key: 'b' });
    const c = { type: 'summary', range: { a: 2, b: true } } as const;
    expect(checkSummary(c, st([a, b], { typed: { 'range-a': 2, 'range-b': 8 } }))).toEqual(ok);
    expect(checkSummary(c, st([a, b], { typed: { 'range-a': 2, 'range-b': 10 } })).code).toBe('range-is-max');
    expect(checkSummary(c, st([a, b], { typed: { 'range-a': 2 } })).code).toBe('empty');
  });
  it('tries traps first', () => {
    const c = { type: 'summary', mean: 8, traps: [{ stat: 'mean', value: 6, code: 'not-moved' }] } as const;
    expect(checkSummary(c, st([set([4, 6, 6, 7, 17])], { typed: { mean: 6 } })).code).toBe('not-moved');
  });
});

describe('checkSummary: best average and sentence frames', () => {
  it('checks the chosen average', () => {
    const c = { type: 'summary', best: 'median', traps: [{ best: 'mean', code: 'mean-pulled' }] } as const;
    const s = [set([1])];
    expect(checkSummary(c, st(s, { best: 'median' }))).toEqual(ok);
    expect(checkSummary(c, st(s)).code).toBe('best-empty');
    expect(checkSummary(c, st(s, { best: 'mean' })).code).toBe('mean-pulled');
    expect(checkSummary(c, st(s, { best: 'mode' })).code).toBe('wrong-best');
    expect(checkSummary({ type: 'summary', best: ['median', 'mode'] }, st(s, { best: 'mode' }))).toEqual(ok);
    // categorical data: no numbers on the engine, only the choice
    expect(checkSummary({ type: 'summary', best: 'mode' }, st([], { best: 'mode' }))).toEqual(ok);
    expect(checkSummary({ type: 'summary', mean: 3 }, st([])).code).toBe('empty');
    expect(checkSummary({ type: 'summary', marked: 'mode' }, st([])).code).toBe('mark-empty');
  });
  it('checks comparison sentences slot by slot', () => {
    const c = {
      type: 'summary',
      compare: { centre: ['a', ['mean', 'median'], 'higher'], spread: ['b', null, 'smaller'] },
      traps: [{ frame: 'spread', slots: ['a', null, null], code: 'more-spread-better' }],
    } as const;
    const s = [set([1], { key: 'a' }), set([2], { key: 'b' })];
    const good = { centre: ['a', 'median', 'higher'], spread: ['b', 'range', 'smaller'] };
    expect(checkSummary(c, st(s, { compare: good }))).toEqual(ok);
    expect(checkSummary(c, st(s, { compare: { centre: ['a', 'mean', 'higher'] } })).code).toBe('frame-missing');
    expect(checkSummary(c, st(s, { compare: { centre: ['a', null, 'higher'] } })).code).toBe('compare-empty');
    expect(checkSummary(c, st(s, { compare: { ...good, spread: ['a', 'range', 'larger'] } })).code).toBe('more-spread-better');
    expect(checkSummary(c, st(s, { compare: { ...good, centre: ['b', 'mean', 'higher'] } })).code).toBe('compare-wrong');
  });
});
