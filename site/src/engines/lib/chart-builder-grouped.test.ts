import { describe, expect, it } from 'vitest';
import { checkGrouped, classOf, counts, expected, groupedMean, groupedMedian, mids, running, type GroupedState } from './chart-builder-grouped';

const ok = { ok: true };
// 20 heights; classes 140 ≤ x < 145 … 165 ≤ x < 170 → 3 4 5 4 3 1
const B = [140, 145, 150, 155, 160, 165, 170];
const D = [152, 145, 141, 158, 150, 162, 147, 155, 143, 153, 160, 149, 167, 156, 151, 144, 164, 146, 157, 154];
const F = [3, 4, 5, 4, 3, 1];
const st = (o: Partial<GroupedState> = {}): GroupedState => ({
  data: [], cards: [], bounds: B, last: false, freq: F, x: mids(B), typed: {}, bars: [], points: [], chosen: null, ...o,
});

describe('grouped data', () => {
  it('puts a value in the class closed on its left', () => {
    expect(classOf(145, B)).toBe(1);
    expect(classOf(144.9, B)).toBe(0);
    expect(classOf(170, B)).toBe(-1);
    expect(classOf(170, B, true)).toBe(5);
    expect(classOf(139, B)).toBe(-1);
  });
  it('counts the classes, and the two slips at the boundaries', () => {
    expect(counts(D, B)).toEqual(F);
    expect(counts(D, B, false, 'both')).toEqual([4, 5, 6, 5, 3, 1]);
    expect(counts(D, B, false, 'right')).toEqual([4, 4, 5, 4, 2, 1]);
  });
  it('works out midpoints, running totals, the mean and the median', () => {
    expect(mids(B)).toEqual([142.5, 147.5, 152.5, 157.5, 162.5, 167.5]);
    expect(running(F)).toEqual([3, 7, 12, 16, 19, 20]);
    expect(groupedMean([10, 20], [1, 3])).toBe(17.5);
    expect(groupedMedian(B, F)).toBe(153); // 150 + (10 − 7) ÷ 5 × 5
    expect(expected({ freq: F, x: mids(B) })['rel-2']).toBe(0.25);
  });
});

describe('checkGrouped: sorting cards', () => {
  const right = D.map((v) => classOf(v, B));
  const c = { type: 'grouped', sorted: true } as const;
  it('passes when every card is in its class', () => {
    expect(checkGrouped(c, st({ data: D, cards: right }))).toEqual(ok);
  });
  it('names the slips', () => {
    expect(checkGrouped(c, undefined).code).toBe('empty');
    expect(checkGrouped(c, st({ data: D, cards: right.map((r, i) => (i ? r : -1)) })).code).toBe('cards-left');
    expect(checkGrouped(c, st({ data: D, cards: right.map((r, i) => (i === 1 ? 0 : r)) })).code).toBe('boundary-left'); // 145 in 140–145
    expect(checkGrouped(c, st({ data: D, cards: right.map((r, i) => (i === 0 ? 3 : r)) })).code).toBe('card-wrong');
  });
});

describe('checkGrouped: the table', () => {
  const c = { type: 'grouped', table: true } as const;
  it('passes with every typed cell right; relative frequencies may be rounded', () => {
    const typed = { 'rel-0': 0.15, 'rel-1': 0.2, 'rel-2': 0.25, 'rel-3': 0.2, 'rel-4': 0.15, 'rel-5': 0.05, 'rel-total': 1 };
    expect(checkGrouped(c, st({ typed }))).toEqual(ok);
    expect(checkGrouped(c, st({ freq: [1, 2], bounds: [0, 10, 20], x: [5, 15], typed: { 'rel-0': 0.33, 'rel-1': 0.67 } }))).toEqual(ok);
  });
  it('names blank cells and each column’s slip', () => {
    expect(checkGrouped(c, st({ typed: { 'f-0': null } })).code).toBe('table-empty');
    expect(checkGrouped(c, st({ data: D, typed: { 'f-0': 4 } })).code).toBe('boundary-twice');
    expect(checkGrouped(c, st({ data: D, typed: { 'f-4': 2 } })).code).toBe('boundary-left');
    expect(checkGrouped(c, st({ data: D, typed: { 'f-5': 2 } })).code).toBe('f-wrong');
    expect(checkGrouped(c, st({ typed: { 'rel-0': 3 } })).code).toBe('rel-is-f');
    expect(checkGrouped(c, st({ typed: { 'rel-0': 0.3 } })).code).toBe('rel-wrong');
    expect(checkGrouped(c, st({ typed: { 'rel-0': 0.15, 'rel-total': 0.9 } })).code).toBe('rel-not-one');
    expect(checkGrouped(c, st({ typed: { 'mid-0': 5 } })).code).toBe('width-not-midpoint');
    expect(checkGrouped(c, st({ typed: { 'mid-1': 145 } })).code).toBe('mid-is-end');
    expect(checkGrouped(c, st({ typed: { 'mid-1': 146 } })).code).toBe('mid-wrong');
    expect(checkGrouped(c, st({ typed: { 'cum-1': 4 } })).code).toBe('cum-not-running');
    expect(checkGrouped(c, st({ typed: { 'fx-0': 427.5, 'fx-total': 3000 } })).code).toBe('total-wrong');
    expect(checkGrouped({ ...c, traps: [{ cell: 'mid-0', value: 140, code: 'lower-end' }] }, st({ typed: { 'mid-0': 140 } })).code).toBe('lower-end');
  });
  it('checks columns in order: frequency before midpoint', () => {
    expect(checkGrouped(c, st({ data: D, typed: { 'mid-0': 5, 'f-0': 4 } })).code).toBe('boundary-twice');
  });
});

describe('checkGrouped: graphs', () => {
  it('chooses the histogram; bars with gaps are caught', () => {
    const c = { type: 'grouped', chosen: 'histogram' } as const;
    expect(checkGrouped(c, st()).code).toBe('choose-empty');
    expect(checkGrouped(c, st({ chosen: 'bars' })).code).toBe('gap-bars');
    expect(checkGrouped(c, st({ chosen: 'polygon' })).code).toBe('wrong-chart');
    expect(checkGrouped({ ...c, traps: [{ chosen: 'polygon', code: 'no-bars' }] }, st({ chosen: 'polygon' })).code).toBe('no-bars');
    expect(checkGrouped(c, st({ chosen: 'histogram' }))).toEqual(ok);
  });
  it('checks the histogram bars', () => {
    const c = { type: 'grouped', histogram: true } as const;
    expect(checkGrouped(c, st({ bars: [0, 0, 0, 0, 0, 0] })).code).toBe('bars-empty');
    expect(checkGrouped(c, st({ bars: [3, 4, 5, 4, 3, 0] })).code).toBe('bar-wrong');
    expect(checkGrouped(c, st({ bars: F }))).toEqual(ok);
  });
  it('checks the frequency polygon at the midpoints', () => {
    const c = { type: 'grouped', polygon: true } as const;
    const at = (xs: number[]): [number, number][] => xs.map((x, i) => [x, F[i]]);
    const good = at(mids(B));
    expect(checkGrouped(c, st({ points: good }))).toEqual(ok);
    expect(checkGrouped(c, st({ points: [[137.5, 0], ...good, [172.5, 0]] }))).toEqual(ok);
    expect(checkGrouped({ ...c, polygon: 'closed' }, st({ points: good })).code).toBe('not-closed');
    expect(checkGrouped({ ...c, polygon: 'closed' }, st({ points: [[137.5, 0], ...good, [172.5, 0]] }))).toEqual(ok);
    expect(checkGrouped(c, st()).code).toBe('points-empty');
    expect(checkGrouped(c, st({ points: at(B.slice(0, 6)) })).code).toBe('polygon-at-ends');
    expect(checkGrouped(c, st({ points: at(B.slice(1)) })).code).toBe('polygon-at-ends');
    expect(checkGrouped(c, st({ points: good.map(([x, y], i) => [x, i ? y : 4]) })).code).toBe('point-wrong');
    expect(checkGrouped(c, st({ points: good.slice(1) })).code).toBe('points-missing');
    expect(checkGrouped(c, st({ points: [...good, [172.5, 2]] })).code).toBe('points-extra');
  });
  it('checks the cumulative frequency graph at the class ends', () => {
    const c = { type: 'grouped', cumulative: true } as const;
    const cum = running(F);
    const good: [number, number][] = B.slice(1).map((e, i) => [e, cum[i]]);
    expect(checkGrouped(c, st({ points: good }))).toEqual(ok);
    expect(checkGrouped(c, st({ points: [[140, 0], ...good] }))).toEqual(ok);
    expect(checkGrouped({ ...c, cumulative: 'from-zero' }, st({ points: good })).code).toBe('cum-no-start');
    expect(checkGrouped(c, st({ points: mids(B).map((m, i) => [m, cum[i]]) })).code).toBe('cum-at-midpoints');
    expect(checkGrouped(c, st({ points: B.slice(1).map((e, i) => [e, F[i]]) })).code).toBe('cum-not-running');
  });
});

describe('checkGrouped: mean and median', () => {
  const x = mids(B);
  const c = { type: 'grouped', mean: true } as const;
  it('accepts the grouped mean', () => {
    expect(checkGrouped(c, st({ typed: { mean: 153.25 } }))).toEqual(ok); // 3065 ÷ 20
    expect(checkGrouped({ type: 'grouped', mean: 153.25 }, st({ typed: { mean: 153.25 } }))).toEqual(ok);
  });
  it('names the classic slips', () => {
    expect(checkGrouped(c, st()).code).toBe('empty');
    expect(checkGrouped(c, st({ typed: { mean: 20 / 6 } })).code).toBe('mean-of-classes');
    expect(checkGrouped(c, st({ typed: { mean: 155 } })).code).toBe('plain-mean');
    expect(checkGrouped(c, st({ typed: { mean: 3065 } })).code).toBe('fx-total-only');
    expect(checkGrouped(c, st({ typed: { mean: 3065 / 6 } })).code).toBe('fx-over-classes');
    expect(checkGrouped(c, st({ typed: { mean: 150.75 } })).code).toBe('mean-uses-ends');
    expect(checkGrouped(c, st({ typed: { mean: 154 } })).code).toBe('too-big');
    expect(x.length).toBe(6);
  });
  it('weights named rows (the mean of two classes’ averages)', () => {
    const rows = st({ bounds: [], freq: [20, 30], x: [14, 16], typed: { mean: 15 } });
    expect(checkGrouped(c, rows).code).toBe('plain-mean');
    expect(checkGrouped(c, { ...rows, typed: { mean: 15.2 } })).toEqual(ok);
  });
  it('reads the median off the cumulative graph', () => {
    const m = { type: 'grouped', median: true, tolerance: 1 } as const;
    expect(checkGrouped(m, st({ typed: { median: 152 } }))).toEqual(ok);
    expect(checkGrouped(m, st({ typed: { median: 10 } })).code).toBe('read-y');
    expect(checkGrouped(m, st({ typed: { median: 158 } })).code).toBe('too-big');
  });
});
