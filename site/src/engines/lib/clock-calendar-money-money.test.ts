import { describe, expect, it } from 'vitest';
import {
  currencyDefaults, currencyFor, diagnoseCompare, diagnoseMoney, fewestPieces, formatMoney, greedyPieces, moneyParts, sum,
} from './clock-calendar-money-money';

const FA = { digits: '۰۱۲۳۴۵۶۷۸۹', decimal: '/' };
const AF = { digits: '۰۱۲۳۴۵۶۷۸۹', decimal: ',' };

describe('currencies per locale', () => {
  it('picks the local currency', () => {
    expect(currencyFor('fa-IR')).toBe('IRR');
    expect(currencyFor('fa-AF')).toBe('AFN');
    expect(currencyFor('ps')).toBe('AFN');
    expect(currencyFor('en')).toBe('GBP');
  });

  it('has sorted default coins and notes; Iranian rial faces are ten times the toman values', () => {
    for (const c of ['IRR', 'AFN', 'GBP'] as const) {
      const { denominations: d, noteFrom } = currencyDefaults(c);
      expect([...d].sort((a, b) => a - b)).toEqual(d);
      expect(d).toContain(noteFrom);
    }
    expect(currencyDefaults('GBP').denominations).toEqual([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]);
    expect(currencyDefaults('IRR', 'rial').denominations).toEqual(currencyDefaults('IRR').denominations.map((v) => v * 10));
  });
});

describe('formatting', () => {
  it('fa-IR: toman or rial with Persian digits', () => {
    expect(formatMoney(500, 'IRR', 'fa-IR', 'toman', FA)).toBe('۵۰۰ تومان');
    expect(formatMoney(5000, 'IRR', 'fa-IR', 'rial', FA)).toBe('۵۰۰۰ ریال');
  });

  it('fa-AF says افغانی, ps says افغانۍ', () => {
    expect(formatMoney(20, 'AFN', 'fa-AF', 'toman', AF)).toBe('۲۰ افغانی');
    expect(formatMoney(20, 'AFN', 'ps', 'toman', AF)).toBe('۲۰ افغانۍ');
  });

  it('en: pence below a pound, £ with two decimals otherwise', () => {
    expect(formatMoney(50, 'GBP', 'en')).toBe('50p');
    expect(formatMoney(100, 'GBP', 'en')).toBe('£1');
    expect(formatMoney(345, 'GBP', 'en')).toBe('£3.45');
    expect(formatMoney(1050, 'GBP', 'en')).toBe('£10.50');
    expect(moneyParts(200, 'GBP', 'en')).toEqual({ n: '2', unit: '£', before: true });
    expect(formatMoney(12000, 'AFN', 'en')).toBe('12,000 afghani');
  });
});

describe('fewest pieces', () => {
  it('finds the fewest coins and notes', () => {
    const gbp = currencyDefaults('GBP').denominations;
    expect(fewestPieces(87, gbp)).toEqual([50, 20, 10, 5, 2]);
    expect(fewestPieces(345, gbp)).toEqual([200, 100, 20, 20, 5]);
    expect(fewestPieces(0, gbp)).toEqual([]);
    expect(fewestPieces(3700, currencyDefaults('IRR').denominations)).toEqual([2000, 1000, 500, 200]);
    expect(fewestPieces(37, currencyDefaults('AFN').denominations)).toEqual([20, 10, 5, 2]);
  });

  it('beats greedy on non-canonical sets and reports impossible amounts', () => {
    expect(fewestPieces(6, [1, 3, 4])).toEqual([3, 3]);
    expect(greedyPieces(6, [1, 3, 4])).toEqual([4, 1, 1]);
    expect(fewestPieces(150, [100, 200])).toBeNull();
    expect(fewestPieces(7, [2, 4])).toBeNull();
    expect(greedyPieces(7, [2, 4])).toEqual([]);
  });

  it('handles large Iranian amounts quickly', () => {
    const d = currencyDefaults('IRR', 'rial').denominations;
    expect(sum(fewestPieces(1_230_000, d)!)).toBe(1_230_000);
  });
});

describe('diagnoseMoney', () => {
  const gbp = currencyDefaults('GBP').denominations;
  it('passes the exact amount and explains wrong totals', () => {
    expect(diagnoseMoney([20, 20, 10], 50)).toBeNull();
    expect(diagnoseMoney([], 50)).toBe('empty');
    expect(diagnoseMoney([50, 10], 50)).toBe('too-big');
    expect(diagnoseMoney([20, 20], 50)).toBe('too-small');
  });

  it('traps known wrong totals, e.g. the price instead of the change', () => {
    const rule = { traps: [{ value: 35, code: 'gave-price' }] };
    expect(diagnoseMoney([20, 10, 5], 65, rule)).toBe('gave-price');
    expect(diagnoseMoney([50, 10, 5], 65, rule)).toBeNull();
  });

  it('checks the number of pieces and the fewest pieces', () => {
    expect(diagnoseMoney([20, 20, 10], 50, { pieces: 3 })).toBeNull();
    expect(diagnoseMoney([20, 10, 10, 10], 50, { pieces: 3 })).toBe('piece-count');
    expect(diagnoseMoney([20, 20, 10], 50, { fewest: true }, gbp)).toBe('not-fewest');
    expect(diagnoseMoney([50], 50, { fewest: true }, gbp)).toBeNull();
    expect(diagnoseMoney([20, 20, 5, 2], 47, { fewest: true }, gbp)).toBeNull();
  });
});

describe('diagnoseCompare', () => {
  const many = [100, 100, 100, 100]; // 4 coins, 400
  const few = [500]; // 1 note, 500
  it('picks the group with more money', () => {
    expect(diagnoseCompare([many, few], 1, 'most')).toBeNull();
    expect(diagnoseCompare([many, few], 0, 'least')).toBeNull();
    expect(diagnoseCompare([many, few], null, 'most')).toBe('empty');
  });

  it('spots counting pieces instead of value', () => {
    expect(diagnoseCompare([many, few], 0, 'most')).toBe('counted-pieces');
    expect(diagnoseCompare([many, few], 1, 'least')).toBe('counted-pieces');
  });

  it('handles equal groups and the "same" answer', () => {
    expect(diagnoseCompare([[200, 200, 100], [500]], -1, 'most')).toBeNull();
    expect(diagnoseCompare([[200, 200, 100], [500]], 0, 'most')).toBe('counted-pieces');
    expect(diagnoseCompare([many, few], -1, 'most')).toBe('not-equal');
    expect(diagnoseCompare([[100, 100], [200], [100, 100, 50]], 1, 'most')).toBe('wrong');
  });
});
