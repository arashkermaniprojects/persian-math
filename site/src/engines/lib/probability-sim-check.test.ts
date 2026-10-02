import { describe, expect, it } from 'vitest';
import { checkChance, type ChanceCheck, type ChanceState } from './probability-sim-check';

const run = (check: Omit<ChanceCheck, 'type'>, s: ChanceState) => checkChance({ type: 'chance', ...check }, s);

describe('chance check: prob (edit the bag)', () => {
  it('certain: only red counters left', () => {
    const c = { prob: { outcomes: ['red'], level: 'certain' } };
    expect(run(c, { probs: { red: [1, 1] } })).toEqual({ ok: true });
    expect(run(c, { probs: { red: [2, 3], blue: [1, 3] } }).code).toBe('too-unlikely');
    expect(run(c, { probs: {} }).code).toBe('empty-bag');
    expect(run(c, {}).code).toBe('empty-bag');
  });
  it('impossible, even and exact values', () => {
    expect(run({ prob: { outcomes: ['blue'], level: 'impossible' } }, { probs: { red: [1, 1] } }).ok).toBe(true);
    expect(run({ prob: { outcomes: ['blue'], level: 'impossible' } }, { probs: { red: [1, 2], blue: [1, 2] } }).code).toBe('too-likely');
    expect(run({ prob: { outcomes: ['red'], level: 'even' } }, { probs: { red: [2, 4], blue: [1, 4], green: [1, 4] } }).ok).toBe(true);
    expect(run({ prob: { outcomes: ['red'], level: 'even' } }, { probs: { red: [1, 3], blue: [2, 3] } }).code).toBe('too-unlikely');
    // several outcomes add up
    expect(run({ prob: { outcomes: ['red', 'blue'], value: [3, 4] } }, { probs: { red: [1, 2], blue: [1, 4], green: [1, 4] } }).ok).toBe(true);
    expect(run({ prob: { outcomes: ['red'], value: [3, 4] } }, { probs: { red: [4, 5], blue: [1, 5] } }).code).toBe('too-likely');
  });
  it('open ranges: possible, likely, unlikely', () => {
    const p = { prob: { outcomes: ['red'], level: 'possible' } };
    expect(run(p, { probs: { red: [1, 3], blue: [2, 3] } }).ok).toBe(true);
    expect(run(p, { probs: { red: [1, 1] } }).code).toBe('too-likely');
    expect(run(p, { probs: { blue: [1, 1] } }).code).toBe('too-unlikely');
    const l = { prob: { outcomes: ['red'], level: 'likely' } };
    expect(run(l, { probs: { red: [2, 3], blue: [1, 3] } }).ok).toBe(true);
    expect(run(l, { probs: { red: [1, 2], blue: [1, 2] } }).code).toBe('too-unlikely');
    expect(run(l, { probs: { red: [1, 1] } }).code).toBe('too-likely');
    const u = { prob: { outcomes: ['red'], level: 'unlikely' } };
    expect(run(u, { probs: { red: [1, 3], blue: [2, 3] } }).ok).toBe(true);
    expect(run(u, { probs: { red: [1, 2], blue: [1, 2] } }).code).toBe('too-likely');
  });
});

describe('chance check: sample space', () => {
  const space = ['red', 'white'];
  it('exactly the possible outcomes', () => {
    expect(run({ space: true }, { listed: ['white', 'red'], space }).ok).toBe(true);
    expect(run({ space: true }, { listed: [], space }).code).toBe('space-empty');
    expect(run({ space: true }, { listed: ['red'], space }).code).toBe('space-missing');
    expect(run({ space: true }, { listed: ['red', 'white', 'blue'], space }).code).toBe('space-extra');
    expect(run({ space: true, traps: [{ listed: 'blue', code: 'no-blue' }] }, { listed: ['red', 'blue'], space }).code).toBe('no-blue');
  });
});

describe('chance check: likelihood line', () => {
  const ev = (placed: (string | null)[], truth = ['possible', 'impossible', 'certain']) =>
    ({ levels: 3 as const, events: truth.map((t, i) => ({ key: ['red', 'blue', 'any'][i], placed: placed[i], truth: t })) });
  it('every event placed at its level', () => {
    expect(run({ scale: true }, ev(['possible', 'impossible', 'certain'])).ok).toBe(true);
    expect(run({ scale: true }, ev(['possible', null, 'certain'])).code).toBe('scale-unplaced');
    expect(run({ scale: true }, { events: [] }).code).toBe('scale-unplaced');
    expect(run({ scale: true }, ev(['certain', 'impossible', 'certain'])).code).toBe('scale-high');
    expect(run({ scale: true }, ev(['possible', 'impossible', 'possible'])).code).toBe('scale-low');
  });
  it('traps by event and level', () => {
    const traps = [{ event: 'red', level: 'certain', code: 'most-not-all' }, { event: 'blue', code: 'no-blue' }];
    expect(run({ scale: true, traps }, ev(['certain', 'impossible', 'certain'])).code).toBe('most-not-all');
    expect(run({ scale: true, traps }, ev(['possible', 'possible', 'certain'])).code).toBe('no-blue');
  });
  it('five levels compare by rank', () => {
    const s = { levels: 5 as const, events: [{ key: 'six', placed: 'even', truth: 'unlikely' }] };
    expect(run({ scale: true }, s).code).toBe('scale-high');
  });
});

describe('chance check: chosen and trials', () => {
  it('chooses the most likely outcome, then tests it with enough trials', () => {
    const c = { chosen: 'blue', trials: 10, traps: [{ chosen: 'red', code: 'smallest' }] };
    expect(run(c, { chosen: 'blue', trials: 10 }).ok).toBe(true);
    expect(run(c, { chosen: null, trials: 10 }).code).toBe('choose-empty');
    expect(run(c, { chosen: 'red', trials: 10 }).code).toBe('smallest');
    expect(run(c, { chosen: 'green', trials: 10 }).code).toBe('choose-wrong');
    expect(run(c, { chosen: 'blue', trials: 3 }).code).toBe('few-trials');
    expect(run({ chosen: ['red', 'blue'] }, { chosen: 'red' }).ok).toBe(true);
    expect(run({ trials: 1 }, {}).code).toBe('few-trials');
  });
  it('order: prob before space before scale before chosen before trials', () => {
    const all = { prob: { outcomes: ['red'], level: 'certain' }, space: true, chosen: 'red', trials: 5 };
    expect(run(all, { probs: { red: [1, 2], blue: [1, 2] }, listed: [], chosen: null }).code).toBe('too-unlikely');
    expect(run(all, { probs: { red: [1, 1] }, listed: [], space: ['red'] }).code).toBe('space-empty');
    expect(run(all, { probs: { red: [1, 1] }, listed: ['red'], space: ['red'] }).code).toBe('choose-empty');
    expect(run(all, { probs: { red: [1, 1] }, listed: ['red'], space: ['red'], chosen: 'red' }).code).toBe('few-trials');
  });
});
