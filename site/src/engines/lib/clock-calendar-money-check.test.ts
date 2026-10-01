import { describe, expect, it } from 'vitest';
import { checkCcm, type CcmState } from './clock-calendar-money-check';
import { evaluate } from '../../lib/checks';

const clock = (time: string, interactive = true): CcmState => ({ clocks: [{ time, interactive }] });

describe('time-equals', () => {
  it('compares on a 12-hour face unless h24', () => {
    expect(checkCcm({ type: 'time-equals', value: '3:00' }, clock('03:00'))).toEqual({ ok: true });
    expect(checkCcm({ type: 'time-equals', value: '3:00' }, clock('15:00'))).toEqual({ ok: true });
    expect(checkCcm({ type: 'time-equals', value: '16:30', h24: true }, clock('04:30'))).toEqual({ ok: false, code: 'am-pm' });
    expect(checkCcm({ type: 'time-equals', value: '3:00' }, clock('00:15'))).toEqual({ ok: false, code: 'hands-swapped' });
    expect(checkCcm({ type: 'time-equals', value: '3:00' }, {})).toEqual({ ok: false, code: 'empty' });
  });

  it('uses the first interactive clock, or the one named', () => {
    const s: CcmState = { clocks: [{ time: '08:15', interactive: false }, { time: '09:00', interactive: true }] };
    expect(checkCcm({ type: 'time-equals', value: '9:00' }, s).ok).toBe(true);
    expect(checkCcm({ type: 'time-equals', value: '8:15', clock: 0 }, s).ok).toBe(true);
  });
});

describe('date-equals', () => {
  const cal = (system: 'solar' | 'gregorian', y: number, m: number, d: number): CcmState => ({ calendar: { system, date: { y, m, d } } });
  it('shared rules work in both calendars', () => {
    expect(checkCcm({ type: 'date-equals', day: 12 }, cal('solar', 1405, 7, 12)).ok).toBe(true);
    expect(checkCcm({ type: 'date-equals', day: 12 }, cal('gregorian', 2026, 10, 12)).ok).toBe(true);
    expect(checkCcm({ type: 'date-equals', month: 1, day: 1 }, cal('gregorian', 2025, 12, 1))).toEqual({ ok: false, code: 'wrong-month' });
    expect(checkCcm({ type: 'date-equals', day: 1 }, { calendar: { system: 'solar', date: null } })).toEqual({ ok: false, code: 'empty' });
  });

  it('per-calendar rules override', () => {
    const c = { type: 'date-equals' as const, solar: { month: 1, day: 1 }, gregorian: { month: 3, day: 21 } };
    expect(checkCcm(c, cal('solar', 1405, 1, 1)).ok).toBe(true);
    expect(checkCcm(c, cal('gregorian', 2026, 3, 21)).ok).toBe(true);
    expect(checkCcm(c, cal('gregorian', 2026, 1, 1)).code).toBe('wrong-month');
  });
});

describe('money-equals', () => {
  const purse = (currency: 'IRR' | 'AFN' | 'GBP', pieces: number[], denominations: number[] = []): CcmState => ({ money: { currency, pieces, denominations } });
  const value = { IRR: 1500, AFN: 15, GBP: 15 };
  it('takes the amount for the learner’s currency', () => {
    expect(checkCcm({ type: 'money-equals', value }, purse('IRR', [1000, 500])).ok).toBe(true);
    expect(checkCcm({ type: 'money-equals', value }, purse('AFN', [10, 5])).ok).toBe(true);
    expect(checkCcm({ type: 'money-equals', value }, purse('GBP', [10, 2, 2, 1])).ok).toBe(true);
    expect(checkCcm({ type: 'money-equals', value }, purse('GBP', [10, 2])).code).toBe('too-small');
    expect(checkCcm({ type: 'money-equals', value: 50 }, purse('GBP', []))).toEqual({ ok: false, code: 'empty' });
    expect(() => checkCcm({ type: 'money-equals', value: { IRR: 5 } }, purse('GBP', [1]))).toThrow();
  });

  it('per-currency traps and the fewest pieces', () => {
    const c = { type: 'money-equals' as const, value: { GBP: 65, IRR: 6500 }, traps: [{ value: { GBP: 35, IRR: 3500 }, code: 'gave-price' }] };
    expect(checkCcm(c, purse('GBP', [20, 10, 5])).code).toBe('gave-price');
    expect(checkCcm(c, purse('IRR', [2000, 1000, 500])).code).toBe('gave-price');
    const gbp = [1, 2, 5, 10, 20, 50, 100, 200];
    expect(checkCcm({ type: 'money-equals', value: 70, fewest: true }, purse('GBP', [20, 20, 20, 10], gbp)).code).toBe('not-fewest');
    expect(checkCcm({ type: 'money-equals', value: 70, fewest: true }, purse('GBP', [50, 20], gbp)).ok).toBe(true);
  });
});

describe('money-compare', () => {
  it('the classic slip: more coins is not more money', () => {
    const s = (selected: number | null): CcmState => ({ money: { currency: 'AFN', pieces: [], denominations: [], groups: [[5, 5, 5, 5], [50]], selected } });
    expect(checkCcm({ type: 'money-compare' }, s(1)).ok).toBe(true);
    expect(checkCcm({ type: 'money-compare', pick: 'most' }, s(0)).code).toBe('counted-pieces');
    expect(checkCcm({ type: 'money-compare' }, s(null)).code).toBe('empty');
  });
});

describe('lib/checks.ts routes these types here', () => {
  it('evaluate() handles every clock-calendar-money check', () => {
    expect(evaluate({ type: 'time-equals', value: '7:30' }, { state: clock('07:30') }).ok).toBe(true);
    expect(evaluate({ type: 'date-equals', day: 'last' }, { state: { calendar: { system: 'solar', date: { y: 1405, m: 1, d: 31 } } } }).ok).toBe(true);
    expect(evaluate({ type: 'money-equals', value: 50 }, { state: { money: { currency: 'GBP', pieces: [50], denominations: [] } } }).ok).toBe(true);
    expect(evaluate({ type: 'money-compare' }, { state: { money: { currency: 'GBP', pieces: [], denominations: [], groups: [[1], [2]], selected: 1 } } }).ok).toBe(true);
  });
});
