import { describe, expect, it } from 'vitest';
import { add, content, divide, equal, evaluate, format, isCollected, keyOf, kindOrder, kindsOf, mul, normalize, parse, parseTerms, poly, powsOf } from './algebra-tiles-poly';

const f = (s: string) => format(poly(s));

describe('monomial keys', () => {
  it('round-trips symbol powers in alphabetical order', () => {
    expect(keyOf({ y: 1, x: 2 })).toBe('x^2*y');
    expect(keyOf({})).toBe('1');
    expect(keyOf({ x: 0 })).toBe('1');
    expect(powsOf('a^2*b')).toEqual({ a: 2, b: 1 });
    expect(powsOf('1')).toEqual({});
  });

  it('orders x², xy, y², x, y, 1', () => {
    expect(['1', 'y', 'x', 'y^2', 'x*y', 'x^2'].sort(kindOrder)).toEqual(['x^2', 'x*y', 'y^2', 'x', 'y', '1']);
  });
});

describe('parse', () => {
  it('reads sums, implicit products, powers and brackets', () => {
    expect(parse('2x + 3')).toEqual({ x: 2, '1': 3 });
    expect(parse('x^2 + x - 2')).toEqual({ 'x^2': 1, x: 1, '1': -2 });
    expect(parse('3(x + 4)')).toEqual({ x: 3, '1': 12 });
    expect(parse('(x + 3)(x + 2)')).toEqual({ 'x^2': 1, x: 5, '1': 6 });
    expect(parse('2a × 3a')).toEqual({ 'a^2': 6 });
    expect(parse('xy + yx')).toEqual({ 'x*y': 2 });
    expect(parse('(a + b)^2')).toEqual({ 'a^2': 1, 'a*b': 2, 'b^2': 1 });
  });

  it('keeps −x² as −(x²) and (−3)² as 9', () => {
    expect(parse('-x^2')).toEqual({ 'x^2': -1 });
    expect(parse('-3^2')).toEqual({ '1': -9 });
    expect(parse('(-3)^2')).toEqual({ '1': 9 });
    expect(parse('4 - (-3)^2')).toEqual({ '1': -5 });
  });

  it('accepts Persian digits, − × · and superscripts as typed or pasted', () => {
    expect(normalize('۳x² − ۲ × y')).toBe('3x^2-2*y');
    expect(parse('۳x² − ۲x + ۱')).toEqual({ 'x^2': 3, x: -2, '1': 1 });
    expect(parse('⁦x + ۲⁩')).toEqual({ x: 1, '1': 2 });
  });

  it('treats labelled roots as symbols', () => {
    expect(parse('2√3 + 5√3')).toEqual({ '√3': 7 });
    expect(parse('√2 + √3')).toEqual({ '√2': 1, '√3': 1 });
  });

  it('reads numbers given as numbers (YAML `1`, `-5`)', () => {
    expect(parse(1 as unknown as string)).toEqual({ '1': 1 });
    expect(poly(-5 as unknown as string)).toEqual({ '1': -5 });
  });

  it('returns null for what cannot be read', () => {
    for (const s of ['', '2x +', '+', 'x ^', '(x + 1', 'x)', '3 $ 4', 'x^y', '3 - -2']) expect(parse(s), s).toBeNull();
    expect(() => poly('2x +')).toThrow();
  });

  it('keeps the written terms apart in parseTerms', () => {
    expect(parseTerms('2x + 3x - 1')).toEqual([{ x: 2 }, { x: 3 }, { '1': -1 }]);
    expect(parseTerms('-x + 3(x + 1)')).toEqual([{ x: -1 }, { x: 3, '1': 3 }]);
  });
});

describe('arithmetic', () => {
  it('adds, multiplies and compares by coefficients', () => {
    expect(add(poly('2x + 3'), poly('x - 3'))).toEqual({ x: 3 });
    expect(add(poly('x'), poly('x'), -1)).toEqual({});
    expect(mul(poly('x - 3'), poly('x + 3'))).toEqual({ 'x^2': 1, '1': -9 });
    expect(equal(poly('3x + 2x'), poly('5x'))).toBe(true);
    expect(equal(poly('3x + 2'), poly('5x'))).toBe(false);
  });

  it('evaluates at given values', () => {
    expect(evaluate(poly('2x + 5'), { x: 3 })).toBe(11);
    expect(evaluate(poly('4 - x^2'), { x: -3 })).toBe(-5);
    expect(evaluate(poly('xy'), { x: 2 })).toBeNaN();
  });

  it('finds the common factor of the coefficients', () => {
    expect(content(poly('12x + 8'))).toBe(4);
    expect(content(poly('6x + 9'))).toBe(3);
    expect(content(poly('x + 1'))).toBe(1);
  });

  it('divides by a polynomial in one letter, with a remainder', () => {
    const d = divide(poly('x^2 + 5x + 6'), poly('x + 2'))!;
    expect(format(d.q)).toBe('x + 3');
    expect(d.r).toEqual({});
    const e = divide(poly('2x^2 - 7x - 15'), poly('x - 5'))!;
    expect(format(e.q)).toBe('2x + 3');
    const g = divide(poly('x^3 - 1'), poly('x - 1'))!;
    expect(format(g.q)).toBe('x^2 + x + 1');
    const h = divide(poly('x^2 + 3x + 5'), poly('x + 1'))!;
    expect([format(h.q), format(h.r)]).toEqual(['x + 2', '3']);
    expect(divide(poly('x'), {})).toBeNull();
    expect(divide(poly('xy'), poly('x'))).toBeNull();
  });
});

describe('format', () => {
  it('writes in order with signs, hiding 1s', () => {
    expect(f('3 - x + 2x^2')).toBe('2x^2 - x + 3');
    expect(f('-x^2 + 4')).toBe('-x^2 + 4');
    expect(f('x - x')).toBe('0');
    expect(f('y x + 2')).toBe('xy + 2');
    expect(f('2√3')).toBe('2√3');
    expect(kindsOf(poly('1 + x + x^2'))).toEqual(['x^2', 'x', '1']);
  });
});

describe('isCollected', () => {
  it('needs single, different, non-zero terms', () => {
    expect(isCollected('3x^2 + 2x - 3')).toBe(true);
    expect(isCollected('-5')).toBe(true);
    expect(isCollected('2x + 3x')).toBe(false);
    expect(isCollected('4 - 9')).toBe(false);
    expect(isCollected('3(x + 4)')).toBe(false);
    expect(isCollected('x + 0')).toBe(false);
    expect(isCollected('2x +')).toBe(false);
  });
});
