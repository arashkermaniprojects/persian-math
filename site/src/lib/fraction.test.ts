import { describe, expect, it } from 'vitest';
import { Frac, asciiDigits, isSimplest, parseDecimal, parseInteger, writtenValue } from './fraction';

describe('Frac', () => {
  it('normalises to lowest terms with a positive denominator', () => {
    expect(new Frac(6, 8).toString()).toBe('3/4');
    expect(new Frac(3, -4).toString()).toBe('-3/4');
    expect(new Frac(0, 5).toString()).toBe('0');
  });

  it('does exact arithmetic', () => {
    const a = new Frac(1, 3), b = new Frac(1, 6);
    expect(a.add(b).toString()).toBe('1/2');
    expect(a.sub(b).toString()).toBe('1/6');
    expect(a.mul(b).toString()).toBe('1/18');
    expect(a.div(b).toString()).toBe('2');
    expect(new Frac(1, 10).add(new Frac(2, 10)).equals(new Frac(3, 10))).toBe(true); // no 0.1+0.2 float error
  });

  it('compares and converts to mixed numbers', () => {
    expect(new Frac(2, 3).cmp(new Frac(3, 5))).toBe(1);
    expect(new Frac(7, 3).toMixed()).toEqual({ whole: 2, rest: new Frac(1, 3) });
  });

  it('rejects zero denominators', () => {
    expect(() => new Frac(1, 0)).toThrow();
  });
});

describe('learner input', () => {
  it('keeps the written form for simplest-form checks', () => {
    expect(isSimplest({ n: 6, d: 8 })).toBe(false);
    expect(writtenValue({ n: 6, d: 8 }).equals(new Frac(3, 4))).toBe(true);
    expect(writtenValue({ whole: 2, n: 1, d: 3 }).equals(new Frac(7, 3))).toBe(true);
  });

  it('accepts Persian, Arabic-Indic and ASCII digits', () => {
    expect(asciiDigits('۱۲۳')).toBe('123');
    expect(parseInteger('٤٥')).toBe(45);
    expect(parseInteger(' 7 ')).toBe(7);
    expect(parseInteger('۳/۴')).toBe(null);
    expect(parseInteger('۲٬۳۰۰٬۰۰۰')).toBe(2300000);
    expect(parseInteger('2,300,000')).toBe(2300000);
    expect(parseInteger('1 000')).toBe(1000);
    expect(parseInteger('12,5')).toBe(null); // a decimal comma is not a thousands separator
  });
});

describe('parseDecimal', () => {
  it('reads each locale decimal mark exactly', () => {
    expect(parseDecimal('۲/۵', '/')?.toString()).toBe('5/2');
    expect(parseDecimal('۰,۳', ',')?.toString()).toBe('3/10');
    expect(parseDecimal('0.1')?.toString()).toBe('1/10');
    expect(parseDecimal('-1.25')?.toString()).toBe('-5/4');
    expect(parseDecimal('7')?.toString()).toBe('7');
    expect(parseDecimal('2/5/1', '/')).toBe(null);
    expect(parseDecimal('abc')).toBe(null);
  });
});
