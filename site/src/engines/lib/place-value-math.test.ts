import { describe, expect, it } from 'vitest';
import {
  bundle, countsOf, defaultView, firstDiff, groupThrees, isCanonical, normalise, roundTo, romanSymbol, separatorFor,
  shift, toRoman, unbundle, valueOf,
} from './place-value-math';

describe('countsOf / valueOf', () => {
  it('splits whole numbers into digits, ones first', () => {
    expect(countsOf(47, 0, 2)).toEqual([7, 4]);
    expect(countsOf(5, 0, 3)).toEqual([5, 0, 0]);
    expect(countsOf(3406, 0, 4)).toEqual([6, 0, 4, 3]);
    expect(countsOf(1234567, 0, 7)).toEqual([7, 6, 5, 4, 3, 2, 1]);
  });
  it('handles decimal places below the ones', () => {
    expect(countsOf('3.45', -2, 4)).toEqual([5, 4, 3, 0]);
    expect(countsOf(0.7, -1, 2)).toEqual([7, 0]);
    expect(countsOf('12', -1, 3)).toEqual([0, 2, 1]);
  });
  it('can start above the ones (a chart of tens and hundreds only)', () => {
    expect(countsOf(340, 1, 2)).toEqual([4, 3]);
  });
  it('round-trips', () => {
    for (const v of ['0', '7', '47', '100', '3406', '1234567'])
      expect(valueOf(countsOf(v, 0, 7), 0)).toBe(v);
    for (const v of ['3.45', '0.07', '12', '0.5', '120.3']) expect(valueOf(countsOf(v, -2, 6), -2)).toBe(v);
  });
  it('values non-canonical counts (14 loose ones is still 14)', () => {
    expect(valueOf([14, 0], 0)).toBe('14');
    expect(valueOf([12, 2], 0)).toBe('32');
    expect(valueOf([0, 13, 1], 0)).toBe('230');
    expect(valueOf([15, 0], -1)).toBe('1.5');
    expect(valueOf([3, 4], 1)).toBe('430');
  });
  it('is exact for large numbers', () => {
    expect(valueOf(countsOf('9876543210', 0, 10), 0)).toBe('9876543210');
  });
});

describe('normalise', () => {
  it('strips leading and trailing zeros', () => {
    expect(normalise('03.50')).toBe('3.5');
    expect(normalise(27)).toBe('27');
    expect(normalise('0.0')).toBe('0');
    expect(normalise('.5')).toBe('0.5');
  });
});

describe('bundle / unbundle', () => {
  it('makes a ten from ten ones', () => {
    expect(bundle([14, 0], 0)).toEqual([4, 1]);
    expect(bundle([9, 0], 0)).toBeNull();
    expect(bundle([14, 0], 1)).toBeNull(); // no higher place
  });
  it('breaks a ten into ten ones', () => {
    expect(unbundle([2, 3], 1)).toEqual([12, 2]);
    expect(unbundle([2, 0], 1)).toBeNull(); // nothing to break
    expect(unbundle([2, 3], 0)).toBeNull(); // no lower place
    expect(unbundle([10, 3], 1)).toBeNull(); // would pass the per-place maximum (19)
    expect(unbundle([10, 3], 1, 30)).toEqual([20, 2]);
  });
  it('keeps the value', () => {
    expect(valueOf(bundle([12, 3], 0)!, 0)).toBe('42');
    expect(valueOf(unbundle([2, 3], 1)!, 0)).toBe('32');
  });
  it('knows canonical form', () => {
    expect(isCanonical([7, 2])).toBe(true);
    expect(isCanonical([12, 2])).toBe(false);
  });
});

describe('shift', () => {
  it('slides every digit one place', () => {
    expect(shift([5, 4, 3, 0], 1)).toEqual([0, 5, 4, 3]);
    expect(shift([0, 5, 4, 3], -1)).toEqual([5, 4, 3, 0]);
  });
  it('refuses to push a digit off the chart', () => {
    expect(shift([1, 0, 0, 7], 1)).toBeNull();
    expect(shift([1, 0, 0, 0], -1)).toBeNull();
  });
  it('× 10 then ÷ 10 is the identity on decimals', () => {
    const c = countsOf('3.45', -2, 5);
    expect(valueOf(shift(c, 1)!, -2)).toBe('34.5');
    expect(valueOf(shift(shift(c, 1)!, -1)!, -2)).toBe('3.45');
    expect(shift(c, -1)).toBeNull(); // the hundredths digit would fall off
  });
});

describe('compare and round', () => {
  it('finds the highest place that differs', () => {
    expect(firstDiff([5, 3, 2], [9, 3, 2])).toBe(0);
    expect(firstDiff([5, 3, 2], [5, 4, 1])).toBe(2);
    expect(firstDiff([1, 2], [1, 2])).toBe(-1);
  });
  it('rounds half up by looking at the next place', () => {
    expect(roundTo(347, 1)).toBe(350);
    expect(roundTo(345, 1)).toBe(350);
    expect(roundTo(344, 1)).toBe(340);
    expect(roundTo(3499, 2)).toBe(3500);
    expect(roundTo(1449999, 6)).toBe(1000000);
    expect(roundTo(4, 1)).toBe(0);
  });
});

describe('roman numerals', () => {
  it('writes standard forms', () => {
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(14)).toBe('XIV');
    expect(toRoman(40)).toBe('XL');
    expect(toRoman(1994)).toBe('MCMXCIV');
    expect(toRoman(3999)).toBe('MMMCMXCIX');
  });
  it('has no zero and stops at 3999', () => {
    expect(toRoman(0)).toBe('');
    expect(toRoman(4000)).toBe('');
    expect(toRoman(2.5)).toBe('');
  });
  it('names the column symbols', () => {
    expect([0, 1, 2, 3, 4].map(romanSymbol)).toEqual(['I', 'X', 'C', 'M', '']);
  });
});

describe('locale helpers', () => {
  it('groups digits in threes', () => {
    expect(groupThrees('1234567', ',')).toBe('1,234,567');
    expect(groupThrees('999', ',')).toBe('999');
    expect(groupThrees('12345.678', ',')).toBe('12,345.678');
  });
  it('picks a thousands separator that cannot be read as the decimal mark', () => {
    expect(separatorFor('/')).toBe('٬');
    expect(separatorFor(',')).toBe(' ');
    expect(separatorFor('.')).toBe(',');
  });
  it('defaults to the abacus for Dari and Pashto', () => {
    expect(defaultView('fa-AF')).toBe('abacus');
    expect(defaultView('ps-AF')).toBe('abacus');
    expect(defaultView('ps')).toBe('abacus');
    expect(defaultView('fa-IR')).toBe('blocks');
    expect(defaultView('en')).toBe('blocks');
  });
});
