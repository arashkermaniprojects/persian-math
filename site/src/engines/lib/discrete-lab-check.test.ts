import { describe, expect, it } from 'vitest';
import { checkSets, type SetsState } from './discrete-lab-check';
import { evaluate } from '../../lib/checks';

const drawn = ['A', 'B', 'AB', 'out'];

describe('cards in regions', () => {
  const check = { type: 'sets' as const, regions: { A: [2, 4], AB: [6], B: [3], out: [1] } };
  const ok: SetsState = { regions: { 2: 'A', 4: 'A', 6: 'AB', 3: 'B', 1: 'out' } };
  it('passes when every card is in its region', () => {
    expect(checkSets(check, ok)).toEqual({ ok: true });
  });
  it('names the mistake', () => {
    expect(checkSets(check, { regions: { ...ok.regions, 1: null } }).code).toBe('cards-left');
    expect(checkSets(check, { regions: { ...ok.regions, 6: 'A' } }).code).toBe('in-both');
    expect(checkSets(check, { regions: { ...ok.regions, 1: 'A' } }).code).toBe('not-a-member');
    expect(checkSets(check, { regions: { ...ok.regions, 3: 'out' } }).code).toBe('is-a-member');
    expect(checkSets(check, { regions: { ...ok.regions, 3: 'A' } }).code).toBe('region-wrong');
    const trap = { ...check, traps: [{ item: 3, region: 'A', code: 'three-is-odd' }] };
    expect(checkSets(trap, { regions: { ...ok.regions, 3: 'A' } }).code).toBe('three-is-odd');
  });
});

describe('members, counts and layout', () => {
  it('compares members in any order', () => {
    const c = { type: 'sets' as const, members: { A: [2, 4] } };
    expect(checkSets(c, { members: { A: ['4', '2'] } }).ok).toBe(true);
    expect(checkSets(c, { members: { A: ['2'] } }).code).toBe('members-missing');
    expect(checkSets(c, { members: { A: ['2', '4', '5'] } }).code).toBe('members-extra');
  });

  it('checks region counts, with traps for counting all of A as "only A"', () => {
    const c = { type: 'sets' as const, counts: { A: 7, AB: 5, B: 3, out: 5 }, traps: [{ count: 'A', value: 12, code: 'only-vs-all' }] };
    expect(checkSets(c, { counts: { A: 7, AB: 5, B: 3, out: 5 } }).ok).toBe(true);
    expect(checkSets(c, { counts: { A: 7, AB: 5, B: null, out: 5 } }).code).toBe('count-empty');
    expect(checkSets(c, { counts: { A: 12, AB: 5, B: 3, out: 5 } }).code).toBe('only-vs-all');
    expect(checkSets(c, { counts: { A: 7, AB: 5, B: 3, out: 0 } }).code).toBe('count-wrong');
  });

  it('checks that the subset is drawn inside, the right way round', () => {
    const c = { type: 'sets' as const, subset: 'C⊆B', traps: [{ layout: 'apart', code: 'they-share' }] };
    expect(checkSets(c, { layout: 'C ⊆ B' }).ok).toBe(true);
    expect(checkSets(c, { layout: 'B⊆C' }).code).toBe('subset-reversed');
    expect(checkSets(c, { layout: 'overlap' }).code).toBe('layout-wrong');
    expect(checkSets(c, {}).code).toBe('layout-wrong');
    expect(checkSets(c, { layout: 'apart' }).code).toBe('they-share');
  });

  it('names a wrong nesting before the cards it pushed out, but sorting comes before nesting', () => {
    const c = { type: 'sets' as const, regions: { BC: [4], B: [2] }, subset: 'C⊆B' };
    expect(checkSets(c, { layout: 'B⊆C', regions: { 4: 'BC', 2: null } }).code).toBe('subset-reversed');
    expect(checkSets(c, { layout: 'overlap', regions: { 4: 'BC', 2: null } }).code).toBe('cards-left');
    expect(checkSets(c, { layout: 'overlap', regions: { 4: 'BC', 2: 'B' } }).code).toBe('layout-wrong');
    expect(checkSets(c, { layout: 'C⊆B', regions: { 4: 'BC', 2: 'B' } }).ok).toBe(true);
  });
});

describe('shading', () => {
  const c = (shaded: string, traps = [{ shaded: 'A ∩ B', code: 'union-intersection' }]) => ({ type: 'sets' as const, shaded, traps });
  it('passes when the shaded regions are the expression', () => {
    expect(checkSets(c('A ∪ B'), { drawn, shaded: ['AB', 'B', 'A'] }).ok).toBe(true);
    expect(checkSets(c('A − B'), { drawn, shaded: ['A'] }).ok).toBe(true);
  });
  it('names the mistake', () => {
    expect(checkSets(c('A ∪ B'), { drawn, shaded: [] }).code).toBe('shade-empty');
    expect(checkSets(c('A ∪ B'), { drawn, shaded: ['AB'] }).code).toBe('union-intersection');
    expect(checkSets(c('A ∪ B'), { drawn, shaded: ['A', 'B'] }).code).toBe('shade-missing');
    expect(checkSets(c('A − B', [{ shaded: 'B − A', code: 'difference-reversed' }]), { drawn, shaded: ['B'] }).code).toBe('difference-reversed');
    expect(checkSets(c('A − B'), { drawn, shaded: ['A', 'AB'] }).code).toBe('shade-extra');
    // A′ without the part outside both ovals
    expect(checkSets(c('A′'), { drawn, shaded: ['B'] }).code).toBe('outside-missed');
  });
});

describe('sets written in braces', () => {
  const members = { A: ['1', '2', '3', '6'], B: ['1', '2', '4', '8'] };
  const c = { type: 'sets' as const, written: { 'A ∪ B': [1, 2, 3, 4, 6, 8] }, traps: [{ written: 'A ∪ B', value: [1, 2], code: 'union-intersection' }] };
  it('accepts any order', () => {
    expect(checkSets(c, { members, written: { 'A ∪ B': ['8', '6', '4', '3', '2', '1'] } }).ok).toBe(true);
  });
  it('catches the overlap written twice, other repeats, missing and extra elements', () => {
    expect(checkSets(c, { members, written: {} }).code).toBe('write-empty');
    expect(checkSets(c, { members, written: { 'A ∪ B': ['1', '2', '3', '6', '1', '2', '4', '8'] } }).code).toBe('overlap-twice');
    expect(checkSets(c, { members, written: { 'A ∪ B': ['1', '2', '3', '3', '4', '6', '8'] } }).code).toBe('repeat');
    expect(checkSets(c, { members, written: { 'A ∪ B': ['1', '2'] } }).code).toBe('union-intersection');
    expect(checkSets(c, { members, written: { 'A ∪ B': ['1', '2', '3'] } }).code).toBe('members-missing');
    expect(checkSets(c, { members, written: { 'A ∪ B': ['1', '2', '3', '4', '6', '8', '9'] } }).code).toBe('members-extra');
  });
  it('the empty set is written as empty braces', () => {
    const e = { type: 'sets' as const, written: { E: [] } };
    expect(checkSets(e, { written: { E: [] } }).ok).toBe(true);
    expect(checkSets(e, { written: { E: ['0'] } }).code).toBe('members-extra');
  });
});

describe('statement rows', () => {
  const c = { type: 'sets' as const, rows: true, traps: [{ row: 'empty', pick: '=', code: 'empty-vs-zero' }] };
  const rows = (p: Record<string, string | null>) => [
    { key: 'el', picked: p.el ?? null, truth: ['∈'] },
    { key: 'sub', picked: p.sub ?? null, truth: ['⊆'] },
    { key: 'empty', picked: p.empty ?? null, truth: ['≠'] },
    { key: 'out', picked: p.out ?? null, truth: ['∉'] },
  ];
  it('passes when every row is true', () => {
    expect(checkSets(c, { rows: rows({ el: '∈', sub: '⊆', empty: '≠', out: '∉' }) }).ok).toBe(true);
  });
  it('names the mistake', () => {
    expect(checkSets(c, { rows: rows({ el: '∈' }) }).code).toBe('rows-unanswered');
    expect(checkSets(c, { rows: rows({ el: '∈', sub: '∈', empty: '≠', out: '∉' }) }).code).toBe('element-vs-subset');
    expect(checkSets(c, { rows: rows({ el: '⊆', sub: '⊆', empty: '≠', out: '∉' }) }).code).toBe('element-vs-subset');
    expect(checkSets(c, { rows: rows({ el: '∈', sub: '⊆', empty: '=', out: '∉' }) }).code).toBe('empty-vs-zero');
    expect(checkSets(c, { rows: rows({ el: '∈', sub: '⊆', empty: '≠', out: '∈' }) }).code).toBe('row-wrong');
  });
});

describe('table, answer and probability', () => {
  it('checks the cells to fill, telling totals apart', () => {
    const c = { type: 'sets' as const, table: true, traps: [{ cell: 't,t', value: 30, code: 'overlap-twice' }] };
    const truth = { '0,1': 7, 't,t': 25 };
    expect(checkSets(c, { table: { cells: { '0,1': 7, 't,t': 25 }, truth } }).ok).toBe(true);
    expect(checkSets(c, { table: { cells: { '0,1': 7, 't,t': null }, truth } }).code).toBe('table-empty');
    expect(checkSets(c, { table: { cells: { '0,1': 7, 't,t': 30 }, truth } }).code).toBe('overlap-twice');
    expect(checkSets(c, { table: { cells: { '0,1': 7, 't,t': 24 }, truth } }).code).toBe('total-wrong');
    expect(checkSets(c, { table: { cells: { '0,1': 6, 't,t': 25 }, truth } }).code).toBe('table-wrong');
  });

  it('checks a typed number after the drawing, with traps', () => {
    const c = { type: 'sets' as const, answer: 15, traps: [{ answer: 20, code: 'overlap-twice' }] };
    expect(checkSets(c, {}, { integer: 15 }).ok).toBe(true);
    expect(checkSets(c, {}, { integer: null }).code).toBe('empty');
    expect(checkSets(c, {}, { integer: 20 }).code).toBe('overlap-twice');
    expect(checkSets(c, {}, { integer: 16 }).code).toBe('too-big');
  });

  it('checks a probability as an equal fraction', () => {
    const c = { type: 'sets' as const, probability: [5, 20] as [number, number], traps: [{ value: [5, 12], code: 'wrong-total' }] };
    expect(checkSets(c, {}, { fraction: { n: 1, d: 4 } }).ok).toBe(true);
    expect(checkSets(c, {}, { fraction: { n: 5, d: 12 } }).code).toBe('wrong-total');
    expect(checkSets(c, {}, { fraction: { n: 1, d: 5 } }).code).toBe('prob-wrong');
  });

  it('is wired into lib/checks.ts as type "sets"', () => {
    expect(evaluate({ type: 'sets', answer: 3 }, { integer: 3, state: { sets: {} } }).ok).toBe(true);
    expect(evaluate({ type: 'sets', shaded: 'A ∩ B' }, { state: { sets: { drawn, shaded: ['AB'] } } }).ok).toBe(true);
  });
});
