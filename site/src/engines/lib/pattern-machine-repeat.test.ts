import { describe, expect, it } from 'vitest';
import { compareCode, madeCode, parseItem, period, repeatUnit, unitCode } from './pattern-machine-repeat';

describe('items', () => {
  it('splits colour and shape, and keeps anything else as text', () => {
    expect(parseItem('red-circle')).toEqual({ color: 'red', shape: 'circle' });
    expect(parseItem('blue-star')).toEqual({ color: 'blue', shape: 'star' });
    expect(parseItem('A')).toEqual({ text: 'A' });
    expect(parseItem('pink-circle')).toEqual({ text: 'pink-circle' });
  });
});

describe('unit and period', () => {
  it('repeats the unit to a length', () => {
    expect(repeatUnit(['a', 'b', 'b'], 7)).toEqual(['a', 'b', 'b', 'a', 'b', 'b', 'a']);
  });
  it('finds the shortest repeating unit, even with a part unit at the end', () => {
    expect(period(['a', 'b', 'a', 'b', 'a'])).toBe(2);
    expect(period(['a', 'b', 'b', 'a', 'b', 'b'])).toBe(3);
    expect(period(['a', 'a', 'a'])).toBe(1);
    expect(period(['a', 'b', 'c'])).toBe(3);
  });
  it('codes a chosen unit', () => {
    const t = repeatUnit(['a', 'b', 'b'], 9);
    expect(unitCode(3, t)).toBeNull();
    expect(unitCode(6, t)).toBe('unit-repeats');
    expect(unitCode(2, t)).toBe('unit-short');
    expect(unitCode(4, t)).toBe('unit-long');
    expect(unitCode(null, t)).toBe('empty');
  });
});

describe('compare with the pattern', () => {
  const target = ['red-circle', 'blue-triangle', 'blue-triangle', 'red-circle'];
  it('passes when every slot matches', () => {
    expect(compareCode([...target], target)).toBeNull();
  });
  it('says not-finished before anything else', () => {
    expect(compareCode(['red-circle', null, 'red-square', 'red-circle'], target)).toBe('not-finished');
  });
  it('tells colour mistakes from shape mistakes', () => {
    expect(compareCode(['red-circle', 'red-triangle', 'blue-triangle', 'red-circle'], target)).toBe('wrong-color');
    expect(compareCode(['red-circle', 'blue-square', 'blue-triangle', 'red-circle'], target)).toBe('wrong-shape');
    expect(compareCode(['red-circle', 'blue-triangle', 'blue-triangle', 'blue-triangle'], target)).toBe('wrong-item');
    expect(compareCode(['A', 'blue-triangle', 'blue-triangle', 'red-circle'], target)).toBe('wrong-item');
  });
});

describe('a learner-made pattern', () => {
  it('must be finished, use two kinds and show its unit twice', () => {
    expect(madeCode(['a', 'b', 'a', 'b'])).toBeNull();
    expect(madeCode(['a', 'b', 'b', 'a', 'b', 'b'])).toBeNull();
    expect(madeCode(['a', 'b', null, 'b'])).toBe('not-finished');
    expect(madeCode(['a', 'a', 'a', 'a'])).toBe('one-kind');
    expect(madeCode(['a', 'b', 'c', 'a', 'b'])).toBe('no-repeat');
    expect(madeCode(['a', 'b', 'a', 'b', 'a', 'b'], 3)).toBeNull();
    expect(madeCode(['a', 'b', 'c', 'a', 'b', 'c'], 3)).toBe('no-repeat');
  });
});
