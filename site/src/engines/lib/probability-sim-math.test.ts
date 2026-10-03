import { describe, expect, it } from 'vitest';
import {
  jointOutcomes, levelOf, outcomeAt, outcomesOf, pickAt, probOf, probTable, rankOf, reduce, rng, runTrials, sampleSpace,
  sectorAngles, sectorAt, sectorPath, tallyGroups, type DeviceConfig,
} from './probability-sim-math';

const bag = (b: Record<string, number>): DeviceConfig => ({ kind: 'bag', bag: b });

describe('devices and outcomes', () => {
  it('coin, dice, spinner and bag outcomes with weights', () => {
    expect(outcomesOf({ kind: 'coin' })).toEqual([{ key: 'heads', w: 1 }, { key: 'tails', w: 1 }]);
    expect(outcomesOf({ kind: 'dice' }).map((o) => o.key)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(outcomesOf({ kind: 'dice', sides: 4 })).toHaveLength(4);
    // same colour in several sectors adds up; sizes weight a sector
    expect(outcomesOf({ kind: 'spinner', sectors: ['blue', 'green', 'blue', { color: 'red', size: 2 }] })).toEqual([
      { key: 'blue', w: 2 }, { key: 'green', w: 1 }, { key: 'red', w: 2 },
    ]);
    // empty colours drop out of a bag
    expect(outcomesOf(bag({ red: 5, white: 1, blue: 0 }))).toEqual([{ key: 'red', w: 5 }, { key: 'white', w: 1 }]);
    expect(outcomesOf({ kind: 'spinner' })).toEqual([]);
  });

  it('joint outcomes and sample spaces of several devices', () => {
    expect(sampleSpace([{ kind: 'coin' }])).toEqual(['heads', 'tails']);
    expect(sampleSpace([{ kind: 'coin' }, { kind: 'coin' }])).toEqual(['heads-heads', 'heads-tails', 'tails-heads', 'tails-tails']);
    const j = jointOutcomes([{ kind: 'coin' }, { kind: 'dice' }]);
    expect(j).toHaveLength(12);
    expect(j[0]).toEqual({ key: 'heads-1', w: 1 });
    expect(sampleSpace([bag({ red: 2, blue: 1 }), { kind: 'coin' }])).toEqual(['red-heads', 'red-tails', 'blue-heads', 'blue-tails']);
  });
});

describe('theoretical probability', () => {
  it('is exact and in lowest terms', () => {
    const b = outcomesOf(bag({ red: 4, white: 2, blue: 1 }));
    expect(probOf(b, ['red'])).toEqual([4, 7]);
    expect(probOf(b, ['red', 'white'])).toEqual([6, 7]);
    expect(probOf(b, ['green'])).toEqual([0, 1]);
    expect(probOf(b, ['red', 'white', 'blue'])).toEqual([1, 1]);
    expect(probOf(outcomesOf({ kind: 'dice' }), ['2', '4', '6'])).toEqual([1, 2]);
    expect(probOf([], ['red'])).toEqual([0, 1]);
    expect(probTable(outcomesOf({ kind: 'spinner', sectors: ['blue', 'blue', 'green', 'red'] }))).toEqual({ blue: [1, 2], green: [1, 4], red: [1, 4] });
    expect(reduce(6, 8)).toEqual([3, 4]);
    expect(reduce(0, 5)).toEqual([0, 1]);
    expect(reduce(3, 0)).toEqual([0, 1]);
  });
});

describe('likelihood scale', () => {
  it('three levels: impossible, possible, certain', () => {
    expect(levelOf([0, 1], 3)).toBe('impossible');
    expect(levelOf([5, 6], 3)).toBe('possible');
    expect(levelOf([1, 6], 3)).toBe('possible');
    expect(levelOf([1, 1], 3)).toBe('certain');
  });
  it('five levels: unlikely below a half, even at a half, likely above', () => {
    expect(levelOf([0, 1])).toBe('impossible');
    expect(levelOf([1, 6])).toBe('unlikely');
    expect(levelOf([3, 6])).toBe('even');
    expect(levelOf([5, 6])).toBe('likely');
    expect(levelOf([6, 6])).toBe('certain');
    expect(rankOf('even', 5)).toBe(2);
    expect(rankOf('possible', 3)).toBe(1);
    expect(rankOf('even', 3)).toBe(-1);
  });
});

describe('random trials', () => {
  it('the generator is seeded, in [0, 1) and repeatable', () => {
    const a = rng(42), b = rng(42), c = rng(7);
    const xs = Array.from({ length: 50 }, a);
    expect(xs).toEqual(Array.from({ length: 50 }, b));
    expect(xs).not.toEqual(Array.from({ length: 50 }, c));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('picks along the weights', () => {
    const o = outcomesOf(bag({ red: 3, white: 1 }));
    expect(pickAt(o, 0)).toBe('red');
    expect(pickAt(o, 0.74)).toBe('red');
    expect(pickAt(o, 0.75)).toBe('white');
    expect(pickAt(o, 0.9999)).toBe('white');
    expect(outcomeAt({ kind: 'coin' }, 0.49)).toBe('heads');
    expect(outcomeAt({ kind: 'dice' }, 0.99)).toBe('6');
  });

  it('a spinner stops on the sector under the pointer, even when a colour is split', () => {
    const sp: DeviceConfig = { kind: 'spinner', sectors: ['blue', 'green', 'blue', 'red'] };
    expect(outcomeAt(sp, 0.1)).toBe('blue');
    expect(outcomeAt(sp, 0.3)).toBe('green');
    expect(outcomeAt(sp, 0.6)).toBe('blue');
    expect(outcomeAt(sp, 0.8)).toBe('red');
  });

  it('runs n trials into a tally, deterministically, close to theory for many trials', () => {
    const dev = [bag({ red: 5, white: 1 })];
    const r1 = runTrials(dev, rng(3), 10);
    const r2 = runTrials(dev, rng(3), 10);
    expect(r1).toEqual(r2);
    expect(Object.values(r1.tally).reduce((s, n) => s + n, 0)).toBe(10);
    const big = runTrials(dev, rng(9), 6000).tally;
    expect(big.red / 6000).toBeCloseTo(5 / 6, 1);
    expect(Object.keys(big).sort()).toEqual(['red', 'white']);
    // a certain event always happens; an impossible one never does
    expect(runTrials([bag({ red: 3 })], rng(1), 100).tally).toEqual({ red: 100 });
    // it adds to an existing tally
    const t = runTrials([{ kind: 'coin' }], rng(1), 4, { heads: 5, tails: 1 }).tally;
    expect(t.heads + t.tails).toBe(10);
    expect(runTrials(dev, rng(1), 0)).toEqual({ tally: {}, last: null });
  });
});

describe('spinner geometry', () => {
  it('sector angles by size, clockwise from 12 o\'clock', () => {
    expect(sectorAngles(['red', 'blue', 'blue', 'green'])).toEqual([
      { color: 'red', a0: 0, a1: 90 }, { color: 'blue', a0: 90, a1: 180 }, { color: 'blue', a0: 180, a1: 270 }, { color: 'green', a0: 270, a1: 360 },
    ]);
    expect(sectorAngles([{ color: 'red', size: 3 }, 'blue']).map((s) => s.a1)).toEqual([270, 360]);
    expect(sectorAt(['red', 'blue'], 10)).toBe(0);
    expect(sectorAt(['red', 'blue'], 190)).toBe(1);
    expect(sectorAt(['red', 'blue'], 370)).toBe(0);
    expect(sectorAt(['red', 'blue'], -10)).toBe(1);
  });
  it('sector paths', () => {
    expect(sectorPath(0, 90, 50)).toBe('M50 50L50 0A50 50 0 0 1 100 50Z');
    expect(sectorPath(0, 270, 50)).toContain(' 0 1 1 ');
    expect(sectorPath(0, 360, 50).startsWith('M50 0A')).toBe(true);
  });
});

it('tally marks in fives', () => {
  expect(tallyGroups(0)).toEqual([]);
  expect(tallyGroups(4)).toEqual([4]);
  expect(tallyGroups(5)).toEqual([5]);
  expect(tallyGroups(12)).toEqual([5, 5, 2]);
});

describe('weights: a bent coin and a biased die', () => {
  it('weights change the probabilities and the draws', () => {
    expect(probTable(outcomesOf({ kind: 'coin', weights: [3, 2] }))).toEqual({ heads: [3, 5], tails: [2, 5] });
    const die: DeviceConfig = { kind: 'dice', weights: [1, 1, 1, 1, 1, 5] };
    expect(probTable(outcomesOf(die))['6']).toEqual([1, 2]);
    expect(sampleSpace([die])).toEqual(['1', '2', '3', '4', '5', '6']);
    const { tally } = runTrials([die], rng(4), 1000);
    expect(tally['6']).toBeGreaterThan(430);
    expect(tally['6']).toBeLessThan(570);
  });
});
