import { describe, expect, it } from 'vitest';
import { longDivision } from './long-division';

const brief = (dividend: number, divisor: number, dec = 0) =>
  longDivision(dividend, divisor, dec).steps.map((s) => [s.pos, s.partial, s.q, s.product, s.rem]);

describe('longDivision: whole numbers', () => {
  it('84 ÷ 4 = 21, one step per digit', () => {
    const p = longDivision(84, 4);
    expect(p.quotient).toBe('21');
    expect(p.remainder).toBe(0);
    expect(brief(84, 4)).toEqual([[0, 8, 2, 8, 0], [1, 4, 1, 4, 0]]);
  });

  it('745 ÷ 3 = 248 remainder 1 (G06 p.60)', () => {
    const p = longDivision(745, 3);
    expect(p.quotient).toBe('248');
    expect(p.remainder).toBe(1);
    expect(brief(745, 3)).toEqual([[0, 7, 2, 6, 1], [1, 14, 4, 12, 2], [2, 25, 8, 24, 1]]);
  });

  it('447 ÷ 21 = 21 remainder 6 (AF G04 p.78): first step takes two digits', () => {
    const p = longDivision(447, 21);
    expect(p.quotient).toBe('21');
    expect(p.remainder).toBe(6);
    expect(brief(447, 21)).toEqual([[1, 44, 2, 42, 2], [2, 27, 1, 21, 6]]);
  });

  it('147 ÷ 7: leading digit smaller than the divisor gives no leading zero', () => {
    expect(longDivision(147, 7).quotient).toBe('21');
    expect(longDivision(147, 7).steps[0]).toMatchObject({ pos: 1, partial: 14 });
  });

  it('612 ÷ 6 = 102: a zero inside the quotient', () => {
    const p = longDivision(612, 6);
    expect(p.quotient).toBe('102');
    expect(brief(612, 6)).toEqual([[0, 6, 1, 6, 0], [1, 1, 0, 0, 1], [2, 12, 2, 12, 0]]);
  });

  it('100 ÷ 5 = 20 and 30 ÷ 3 = 10: trailing zeros in the quotient', () => {
    expect(longDivision(100, 5).quotient).toBe('20');
    expect(longDivision(30, 3).quotient).toBe('10');
    expect(longDivision(30, 3).remainder).toBe(0);
  });

  it('remainders: 17 ÷ 5 = 3 r 2 without decimals', () => {
    const p = longDivision(17, 5);
    expect(p.quotient).toBe('3');
    expect(p.remainder).toBe(2);
    expect(p.decimals).toBe(0);
  });

  it('dividend smaller than the divisor and no decimals: quotient 0, remainder = dividend', () => {
    const p = longDivision(3, 4);
    expect(p.quotient).toBe('0');
    expect(p.remainder).toBe(3);
    expect(brief(3, 4)).toEqual([[0, 3, 0, 0, 3]]);
  });

  it('0 ÷ 5 = 0', () => {
    expect(longDivision(0, 5).quotient).toBe('0');
  });

  it('rejects bad input', () => {
    expect(() => longDivision(5, 0)).toThrow();
    expect(() => longDivision(-5, 2)).toThrow();
    expect(() => longDivision(2.5, 2)).toThrow();
  });
});

describe('longDivision: continuing into decimals', () => {
  it('3 ÷ 8 = 0.375', () => {
    const p = longDivision(3, 8, 3);
    expect(p.quotient).toBe('0.375');
    expect(p.remainder).toBe(0);
    expect(p.decimals).toBe(3);
    expect(p.digits).toEqual([3, 0, 0, 0]);
    expect(brief(3, 8, 3)).toEqual([[0, 3, 0, 0, 3], [1, 30, 3, 24, 6], [2, 60, 7, 56, 4], [3, 40, 5, 40, 0]]);
  });

  it('3 ÷ 4 = 0.75 and stops early when the remainder is 0', () => {
    const p = longDivision(3, 4, 5);
    expect(p.quotient).toBe('0.75');
    expect(p.decimals).toBe(2);
    expect(p.remainder).toBe(0);
  });

  it('7 ÷ 8 = 0.875', () => {
    expect(longDivision(7, 8, 3).quotient).toBe('0.875');
  });

  it('1 ÷ 3 to 2 places = 0.33 remainder 1 (does not end)', () => {
    const p = longDivision(1, 3, 2);
    expect(p.quotient).toBe('0.33');
    expect(p.remainder).toBe(1);
    expect(brief(1, 3, 2)).toEqual([[0, 1, 0, 0, 1], [1, 10, 3, 9, 1], [2, 10, 3, 9, 1]]);
  });

  it('3 ÷ 5 = 0.6; 10 ÷ 4 = 2.5; 21 ÷ 8 = 2.625', () => {
    expect(longDivision(3, 5, 2).quotient).toBe('0.6');
    expect(longDivision(10, 4, 2).quotient).toBe('2.5');
    expect(longDivision(21, 8, 3).quotient).toBe('2.625');
  });

  it('a zero right after the decimal mark: 1 ÷ 20 = 0.05', () => {
    const p = longDivision(1, 20, 2);
    expect(p.quotient).toBe('0.05');
    expect(brief(1, 20, 2)).toEqual([[0, 1, 0, 0, 1], [1, 10, 0, 0, 10], [2, 100, 5, 100, 0]]);
  });

  it('decimals = 0 keeps a whole-number remainder', () => {
    expect(longDivision(7, 8, 0).quotient).toBe('0');
    expect(longDivision(7, 8, 0).remainder).toBe(7);
  });
});
