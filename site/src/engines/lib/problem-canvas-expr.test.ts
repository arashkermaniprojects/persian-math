import { describe, expect, it } from 'vitest';
import { evaluate, parseNum, tidy } from './problem-canvas-expr';

describe('parseNum', () => {
  it('reads Persian, Arabic-Indic and ASCII digits', () => {
    expect(parseNum('۲۳')).toBe(23);
    expect(parseNum('٤٥')).toBe(45);
    expect(parseNum(' 17 ')).toBe(17);
    expect(parseNum('۱۲۰')).toBe(120);
  });
  it('uses the locale decimal mark', () => {
    expect(parseNum('۲/۵', '/')).toBe(2.5);
    expect(parseNum('۲,۵', ',')).toBe(2.5);
    expect(parseNum('2.5')).toBe(2.5);
    expect(parseNum('۲٫۵', '/')).toBe(2.5);
  });
  it('reads negatives and ignores thousands separators', () => {
    expect(parseNum('−۴')).toBe(-4);
    expect(parseNum('۱٬۰۰۰')).toBe(1000);
  });
  it('rejects anything that is not one number', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum('3+4')).toBeNull();
    expect(parseNum('۲/۵')).toBeNull(); // "/" is not a decimal mark in en
  });
});

describe('evaluate', () => {
  it('follows the order of operations and brackets', () => {
    expect(evaluate('2 + 3 × 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('24 ÷ 3 − 2')).toBe(6);
    expect(evaluate('10 - 4 - 3')).toBe(3);
    expect(evaluate('-3 + 5')).toBe(2);
    expect(evaluate('2 * -3')).toBe(-6);
  });
  it('uses variables', () => {
    expect(evaluate('4*x + 2*(10-x)', { x: 3 })).toBe(26);
    expect(evaluate('a + b', { a: 1, b: 24 })).toBe(25);
  });
  it('returns null for errors, missing variables and division by zero', () => {
    expect(evaluate('2 +')).toBeNull();
    expect(evaluate('(2 + 3')).toBeNull();
    expect(evaluate('2 3')).toBeNull();
    expect(evaluate('x + 1')).toBeNull();
    expect(evaluate('x + 1', { x: null })).toBeNull();
    expect(evaluate('5 / 0')).toBeNull();
    expect(evaluate('alert(1)')).toBeNull();
    expect(evaluate('')).toBeNull();
  });
  it('tidies floating-point noise', () => {
    expect(evaluate('0.1 + 0.2')).toBe(0.3);
    expect(tidy(1 / 3 * 3)).toBe(1);
  });
});
