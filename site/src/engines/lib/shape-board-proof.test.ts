import { describe, expect, it } from 'vitest';
import { canon, checkProof, holds, part, type ProofCheck, type Row } from './shape-board-proof';
import type { ShapeBoardState } from './shape-board-check';
import type { P } from './shape-board-geom';

// a kite ABCD: AB = AD, CB = CD, AC common
const kite: Record<string, P> = { A: [3, 5], B: [1, 3], C: [3, 0], D: [5, 3] };
const board = (proof: Partial<NonNullable<ShapeBoardState['proof']>>, dyn: Partial<NonNullable<ShapeBoardState['dyn']>> = {}): ShapeBoardState => ({
  proof: { rows: [], criterion: null, corr: [], ...proof },
  dyn: { pts: kite, values: {}, dragged: 0, chosen: null, locked: true, ...dyn },
});
const given: Row[] = [{ s: 'A B = A D', r: 'given', locked: true }, { s: 'C B = C D', r: 'given', locked: true }];
const kiteProof: ProofCheck = {
  type: 'proof',
  facts: ['A B = A D', 'C B = C D'],
  conclusion: 'A B C = A D C',
  steps: [
    { s: 'A C = A C', r: 'common' },
    { s: 'A B C ≅ A D C', r: 'sss', after: ['A C = A C'] },
    { s: 'A B C = A D C', r: 'cpct', after: ['A B C ≅ A D C'] },
  ],
};
const right: Row[] = [...given, { s: 'C A = A C', r: 'common' }, { s: 'A D C ≅ A B C', r: 'sss' }, { s: 'C D A = A B C', r: 'cpct' }];

describe('canonical statements', () => {
  it('sides and angles in either direction', () => {
    expect(part('B A')).toBe('A B');
    expect(part('C B A')).toBe('A B C');
    expect(canon('A D = B A')).toBe(canon('A B = A D'));
    expect(canon('C B A = A D C')).toBe(canon('A D C = A B C'));
  });
  it('a congruence by its vertex pairs, either triangle first, any vertex order', () => {
    expect(canon('A B C ≅ A D C')).toBe(canon('A D C ≅ A B C'));
    expect(canon('A B C ≅ A D C')).toBe(canon('B C A ≅ D C A'));
    expect(canon('A B C ≅ A D C')).not.toBe(canon('A B C ≅ A C D'));
  });
  it('truth in the figure', () => {
    expect(holds('A B = A D', kite)).toBe(true);
    expect(holds('A B = B C', kite)).toBe(false);
    expect(holds('A B C = A D C', kite)).toBe(true);
    expect(holds('A B C ≅ A D C', kite)).toBe(true);
    expect(holds('A B C ≅ C D A', kite)).toBe(false);
    expect(holds('A Z = A B', kite)).toBe(null);
  });
});

describe('criterion and correspondence', () => {
  it('criterion: right, nothing chosen, AAA/SSA, a trap, another', () => {
    const c: ProofCheck = { type: 'proof', criterion: 'sas', traps: [{ criterion: 'asa', code: 'angle-not-side' }] };
    expect(checkProof(c, board({ criterion: 'sas' }))).toEqual({ ok: true });
    expect(checkProof(c, board({}))).toEqual({ ok: false, code: 'empty' });
    expect(checkProof(c, undefined)).toEqual({ ok: false, code: 'empty' });
    expect(checkProof(c, board({ criterion: 'aaa' }))).toEqual({ ok: false, code: 'aaa' });
    expect(checkProof(c, board({ criterion: 'ssa' }))).toEqual({ ok: false, code: 'ssa' });
    expect(checkProof(c, board({ criterion: 'asa' }))).toEqual({ ok: false, code: 'angle-not-side' });
    expect(checkProof(c, board({ criterion: 'sss' }))).toEqual({ ok: false, code: 'wrong-criterion' });
  });
  it('none is a choice too (AAA is not enough)', () => {
    expect(checkProof({ type: 'proof', criterion: 'none' }, board({ criterion: 'aaa' })).code).toBe('aaa');
  });
  it('correspondence: order matters', () => {
    const c: ProofCheck = { type: 'proof', correspondence: 'F D E', traps: [{ corr: 'D E F', code: 'alphabet' }] };
    expect(checkProof(c, board({ corr: ['F', 'D', 'E'] }))).toEqual({ ok: true });
    expect(checkProof(c, board({ corr: ['F', 'D'] })).code).toBe('empty');
    expect(checkProof(c, board({ corr: ['D', 'E', 'F'] })).code).toBe('alphabet');
    expect(checkProof(c, board({ corr: ['E', 'D', 'F'] })).code).toBe('order');
    expect(checkProof(c, board({ corr: ['F', 'D', 'A'] })).code).toBe('wrong-correspondence');
  });
});

describe('proof steps', () => {
  it('a full proof passes in any equivalent wording', () => {
    expect(checkProof(kiteProof, board({ rows: right }))).toEqual({ ok: true });
  });
  it('nothing written, a missing reason, a missing step', () => {
    expect(checkProof(kiteProof, board({ rows: given })).code).toBe('empty');
    expect(checkProof(kiteProof, board({ rows: [...given, { s: 'A C = A C', r: null }] })).code).toBe('no-reason');
    expect(checkProof(kiteProof, board({ rows: [...given, { s: 'A C = A C', r: 'common' }] })).code).toBe('missing-step');
  });
  it('reasons: from the picture, given when it is not, the conclusion as a reason', () => {
    const rows = (r: Row) => board({ rows: [...given, r] });
    expect(checkProof(kiteProof, rows({ s: 'A C = A C', r: 'looks' })).code).toBe('looks-equal');
    expect(checkProof(kiteProof, rows({ s: 'A B C = A D C', r: 'given' })).code).toBe('circular');
    expect(checkProof(kiteProof, rows({ s: 'A C = A C', r: 'given' })).code).toBe('not-given');
    expect(checkProof(kiteProof, rows({ s: 'A C = A C', r: 'goal' })).code).toBe('circular');
  });
  it('a false statement, a wrong reason (or its trap), steps out of order', () => {
    expect(checkProof(kiteProof, board({ rows: [...given, { s: 'A B = B C', r: 'common' }] })).code).toBe('false-statement');
    expect(checkProof(kiteProof, board({ rows: [...given, { s: 'A B C ≅ A C D', r: 'sss' }] })).code).toBe('order');
    const swap = right.map((r) => (r.r === 'sss' ? { ...r, r: 'sas' } : r));
    expect(checkProof(kiteProof, board({ rows: swap })).code).toBe('wrong-reason');
    expect(checkProof({ ...kiteProof, traps: [{ reason: 'sas', code: 'no-angle' }] }, board({ rows: swap })).code).toBe('no-angle');
    // the angles stated (cpct) before the triangles are congruent: circular
    const early = [...given, right[4], right[2], right[3]];
    expect(checkProof(kiteProof, board({ rows: early })).code).toBe('circular');
    // the congruence before the common side
    expect(checkProof(kiteProof, board({ rows: [...given, right[3], right[2], right[4]] })).code).toBe('step-order');
  });
});

describe('counterexample', () => {
  const c: ProofCheck = { type: 'proof', dragged: 1, counterexample: { hypothesis: [['ef', 'bc']], conclusion: [['df', 'ac'], ['d', 60]] } };
  const at = (values: Record<string, number | null>, dragged = 2) => board({}, { values, dragged });
  it('explore first, keep the hypothesis, break the conclusion', () => {
    expect(checkProof(c, at({ ef: 3.6, bc: 3.6, df: 1, ac: 3, d: 60 }, 0)).code).toBe('not-dragged');
    expect(checkProof(c, at({ ef: 4.6, bc: 3.6, df: 4, ac: 3, d: 60 })).code).toBe('hypothesis-broken');
    expect(checkProof(c, at({ ef: null, bc: 3.6, df: 4, ac: 3, d: 60 })).code).toBe('hypothesis-broken');
    expect(checkProof(c, at({ ef: 3.6, bc: 3.6, df: 3, ac: 3, d: 60 })).code).toBe('conclusion-holds');
    expect(checkProof(c, at({ ef: 3.6, bc: 3.6, df: 1, ac: 3, d: 60 }))).toEqual({ ok: true });
  });
  it('numbers in pairs, and a tolerance', () => {
    const r: ProofCheck = { type: 'proof', counterexample: { hypothesis: [['p', 'q']], conclusion: [['a', 90]], tolerance: 0.05 } };
    expect(checkProof(r, at({ p: 5, q: 5.04, a: 90 })).code).toBe('conclusion-holds');
    expect(checkProof(r, at({ p: 5, q: 5.04, a: 80 }))).toEqual({ ok: true });
    expect(checkProof(r, board({})).code).toBe('hypothesis-broken');
    expect(checkProof(r, { proof: { rows: [], criterion: null, corr: [] } }).code).toBe('empty');
  });
});
