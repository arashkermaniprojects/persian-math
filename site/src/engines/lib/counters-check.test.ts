import { describe, expect, it } from 'vitest';
import { evaluate, type Check } from '../../lib/checks';
import type { ZoneState } from './counters-model';

const z = (count: number, marked = 0, colors: [number, number] = [count - marked, 0], extra: Partial<ZoneState> = {}): ZoneState => ({ count, marked, colors, ...extra });
const run = (check: Omit<Extract<Check, { type: 'counters' }>, 'type'>, zones: ZoneState[], picked: number | null = null) =>
  evaluate({ type: 'counters', ...check }, { state: { zones, picked } });

describe('counters check', () => {
  it('join: every counter moved to the frame, then the total picked', () => {
    const check = { count: [0, 0, 7], pick: 7, traps: [{ pick: 4, code: 'one-group' }] };
    expect(run(check, [z(0), z(0), z(7)], 7)).toEqual({ ok: true });
    expect(run(check, [z(1), z(0), z(6)], 7).code).toBe('too-many');
    expect(run(check, [z(0), z(0), z(7)], null).code).toBe('empty');
    expect(run(check, [z(0), z(0), z(7)], 4).code).toBe('one-group');
    expect(run(check, [z(0), z(0), z(7)], 8).code).toBe('too-big');
    expect(run(check, [z(0), z(0), z(7)], 6).code).toBe('too-small');
  });

  it('per-zone counts use null for "any"', () => {
    expect(run({ count: [null, 3] }, [z(9), z(3)]).ok).toBe(true);
    expect(run({ count: [null, 3] }, [z(9), z(2)]).code).toBe('too-few');
    // a zone that does not exist counts as empty
    expect(run({ count: [null, null, 1] }, [z(9)]).code).toBe('too-few');
  });

  it('take away: marked counters, and counters left', () => {
    const check = { marked: 3, left: 5, pick: 5, traps: [{ pick: 3, code: 'took' }] };
    expect(run(check, [z(8, 3)], 5).ok).toBe(true);
    expect(run(check, [z(8, 2)], 5).code).toBe('marked-too-few');
    expect(run(check, [z(8, 4)], 5).code).toBe('marked-too-many');
    expect(run(check, [z(8, 3)], 3).code).toBe('took');
    expect(run({ marked: [3, 0] }, [z(7, 3), z(4, 1)]).code).toBe('marked-too-many');
  });

  it('a total counts only the zones in `in`', () => {
    expect(run({ count: 12, in: [1, 2, 3] }, [z(0), z(4), z(4), z(4)]).ok).toBe(true);
    expect(run({ count: 12 }, [z(2), z(4), z(4), z(4)]).code).toBe('too-many');
  });

  it('sharing: equal groups, an empty pool, and a group size', () => {
    const plates = [z(0), z(4), z(4), z(4)];
    expect(run({ count: [0], equal: true, in: [1, 2, 3] }, plates).ok).toBe(true);
    expect(run({ count: [0], equal: true, in: [1, 2, 3] }, [z(0), z(5), z(4), z(3)]).code).toBe('not-equal');
    expect(run({ count: [0], equal: true, in: [1, 2, 3] }, [z(3), z(3), z(3), z(3)]).code).toBe('too-many');
    expect(run({ each: 4, in: [1, 2, 3] }, plates).ok).toBe(true);
    expect(run({ each: 3, in: [1, 2, 3] }, plates).code).toBe('too-many');
    expect(run({ each: 5, in: [1, 2, 3] }, plates).code).toBe('too-few');
    expect(run({ each: 4, in: [1, 2, 3] }, [z(0), z(4), z(3), z(4)]).code).toBe('not-equal');
  });

  it('number bonds: colours, optionally in either order', () => {
    expect(run({ colors: [6, 4] }, [z(10, 0, [6, 4])]).ok).toBe(true);
    expect(run({ colors: [6, 4] }, [z(10, 0, [4, 6])]).code).toBe('wrong-colors');
    expect(run({ colors: [6, 4], anyOrder: true }, [z(10, 0, [4, 6])]).ok).toBe(true);
    // colours add up over zones
    expect(run({ colors: [3, 4] }, [z(3, 0, [3, 0]), z(4, 0, [0, 4])]).ok).toBe(true);
  });

  it('arrays: size in either order, and full rectangles', () => {
    const arr = (rows: number, cols: number, count = rows * cols) => z(count, 0, [count, 0], { rows, cols });
    expect(run({ array: [3, 4] }, [arr(3, 4)]).ok).toBe(true);
    expect(run({ array: [3, 4] }, [arr(4, 3)]).code).toBe('wrong-array');
    expect(run({ array: [3, 4], anyOrder: true }, [arr(4, 3)]).ok).toBe(true);
    expect(run({ rect: true }, [arr(3, 5, 12)]).code).toBe('not-rect');
    expect(run({ rect: true }, [arr(4, 3, 12)]).ok).toBe(true);
    expect(run({ array: [1, 1] }, [z(3)]).code).toBe('wrong-array');
  });

  it('factor tree must end in primes', () => {
    expect(run({ tree: true }, [z(0, 0, [0, 0], { leaves: [2, 2, 3], done: true })]).ok).toBe(true);
    expect(run({ tree: true }, [z(0, 0, [0, 0], { leaves: [3, 4], done: false })]).code).toBe('tree-unfinished');
    expect(run({ tree: true }, []).code).toBe('tree-unfinished');
  });

  it('checks are tested in order: counters first, then the picked number', () => {
    expect(run({ marked: 3, pick: 5 }, [z(8, 1)], 9).code).toBe('marked-too-few');
  });
});
