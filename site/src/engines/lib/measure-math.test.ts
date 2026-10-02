import { describe, expect, it } from 'vitest';
import {
  angleReading, between, clamp, convert, dialAngle, dialValue, norm, numText, pointerAngle, protractorReading,
  rulerReading, snapRotation, furthestEnd, objectRow, snapTo, stripFactors, ticks, tidy, tilt, UNITS,
} from './measure-math';

describe('units and conversion', () => {
  it('converts metric length, mass, capacity and area', () => {
    expect(convert(3, 'm', 'cm')).toBe(300);
    expect(convert(64, 'mm', 'cm')).toBe(6.4);
    expect(convert(2.5, 'km', 'm')).toBe(2500);
    expect(convert(1500, 'g', 'kg')).toBe(1.5);
    expect(convert(0.75, 'l', 'ml')).toBe(750);
    expect(convert(1, 'm2', 'cm2')).toBe(10000);
  });
  it('converts UK imperial units to metric', () => {
    expect(convert(1, 'in', 'cm')).toBe(2.54);
    expect(convert(1, 'ft', 'in')).toBe(12);
    expect(convert(1, 'mile', 'yd')).toBe(1760);
    expect(convert(1, 'lb', 'oz')).toBe(16);
    expect(convert(1, 'st', 'lb')).toBe(14);
    expect(convert(1, 'gal', 'pint')).toBe(8);
  });
  it('refuses to convert between kinds or unknown units', () => {
    expect(() => convert(1, 'kg', 'm')).toThrow();
    expect(() => convert(1, 'cubit', 'm')).toThrow();
  });
  it('gives the factors between neighbours on a strip', () => {
    expect(stripFactors(['km', 'm', 'cm', 'mm'])).toEqual([1000, 100, 10]);
    expect(stripFactors(['kg', 'g'])).toEqual([1000]);
    expect(stripFactors(['mm', 'cm'])).toEqual([0.1]);
  });
  it('knows every unit by kind', () => {
    expect(UNITS.cm[0]).toBe('len');
    expect(UNITS.ml[0]).toBe('cap');
    expect(UNITS.C[0]).toBe('temp');
  });
});

describe('numbers', () => {
  it('tidies floating-point noise', () => {
    expect(tidy(0.1 + 0.2)).toBe(0.3);
    expect(tidy(6.4)).toBe(6.4);
  });
  it('clamps and snaps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(snapTo(6.43, 0.1, 0, 10)).toBe(6.4);
    expect(snapTo(260, 100, 0, 1000)).toBe(300);
    expect(snapTo(1200, 100, 0, 1000)).toBe(1000);
    expect(snapTo(-7, 2, -10, 10, -10)).toBe(-6);
  });
  it('writes labels with locale digits and decimal mark', () => {
    expect(numText(6.4, '۰۱۲۳۴۵۶۷۸۹', '/')).toBe('۶/۴');
    expect(numText(0.5, '۰۱۲۳۴۵۶۷۸۹', ',')).toBe('۰,۵');
    expect(numText(-5)).toBe('\u22125');
    expect(numText(1000)).toBe('1000');
  });
});

describe('ticks', () => {
  it('marks centimetres, half-centimetres and millimetres on a ruler', () => {
    const t = ticks(0, 2, 1, 0.1);
    expect(t).toHaveLength(21);
    expect(t[0]).toEqual({ v: 0, kind: 'major' });
    expect(t[5]).toEqual({ v: 0.5, kind: 'mid' });
    expect(t[3].kind).toBe('minor');
    expect(t[10]).toEqual({ v: 1, kind: 'major' });
  });
  it('has no mid tick when half a major is not a minor tick', () => {
    expect(ticks(0, 300, 100, 100).map((t) => t.kind)).toEqual(['major', 'major', 'major', 'major']);
    expect(ticks(0, 200, 200, 100).map((t) => t.kind)).toEqual(['major', 'mid', 'major']);
  });
  it('works for negative temperatures', () => {
    const t = ticks(-10, 10, 10, 2);
    expect(t[0]).toEqual({ v: -10, kind: 'major' });
    expect(t.find((x) => x.v === 0)?.kind).toBe('major');
    expect(t.find((x) => x.v === -4)?.kind).toBe('minor');
  });
});

describe('ruler', () => {
  it('is aligned when the object starts at 0', () => {
    expect(rulerReading(0, 7)).toEqual({ aligned: true, end: 7, misreads: [] });
  });
  it('reports reading the end as a misreading when not from zero', () => {
    expect(rulerReading(-2, 7)).toEqual({ aligned: false, end: 5, misreads: [[5, 'not-from-zero']] });
    expect(rulerReading(1, 7).misreads).toEqual([[8, 'not-from-zero']]);
    expect(rulerReading(0.3, 6.4).end).toBe(6.7);
  });
});

describe('angles', () => {
  it('normalises and measures between rays', () => {
    expect(norm(-30)).toBe(330);
    expect(norm(370)).toBe(10);
    expect(between(20, 85)).toBe(65);
    expect(between(85, 20)).toBe(65);
    expect(between(350, 10)).toBe(20);
    expect(between(0, 180)).toBe(180);
  });
  it('reads pointer angles counter-clockwise from the right, in screen coordinates', () => {
    expect(pointerAngle(0, 0, 10, 0)).toBe(0);
    expect(pointerAngle(0, 0, 0, -10)).toBe(90);
    expect(pointerAngle(0, 0, -10, 0)).toBe(180);
    expect(pointerAngle(0, 0, 0, 10)).toBe(270);
  });
  it('reads both scales of a protractor', () => {
    expect(protractorReading(0, 65)).toEqual({ outer: 65, inner: 115 });
    expect(protractorReading(20, 85)).toEqual({ outer: 65, inner: 115 });
    expect(protractorReading(0, 200)).toBeNull();
  });
  it('knows when the protractor is lined up with an arm', () => {
    const ok = angleReading(20, [20, 85]);
    expect(ok.value).toBe(65);
    expect(ok.aligned).toBe(true);
    expect(ok.misreads).toEqual([[115, 'other-scale']]);
    // baseline along the other arm, protractor turned over
    expect(angleReading(265, [20, 85]).aligned).toBe(true);
    expect(angleReading(200, [20, 85]).aligned).toBe(true);
  });
  it('lists what a learner would read with the protractor not lined up', () => {
    const r = angleReading(0, [20, 85]);
    expect(r.aligned).toBe(false);
    expect(r.misreads).toEqual([[20, 'not-from-zero'], [160, 'not-from-zero'], [85, 'not-from-zero'], [95, 'not-from-zero']]);
  });
  it('has no other-scale misreading for a right angle', () => {
    expect(angleReading(0, [0, 90]).misreads).toEqual([]);
  });
  it('snaps the protractor onto a nearby arm', () => {
    expect(snapRotation(17, [20, 85])).toBe(20);
    expect(snapRotation(263, [20, 85])).toBe(265);
    expect(snapRotation(358, [0])).toBe(0);
    expect(snapRotation(50.4, [20, 85])).toBe(50);
  });
});

describe('balance and dial', () => {
  it('tilts towards the heavier pan, and is level only when equal', () => {
    expect(tilt(600, 600)).toBe(0);
    expect(tilt(600, 650)).toBeGreaterThan(0);
    expect(tilt(600, 650)).toBeGreaterThanOrEqual(5);
    expect(tilt(600, 100)).toBeLessThan(0);
    expect(tilt(600, 0)).toBe(-14);
    expect(tilt(0, 0)).toBe(0);
  });
  it('maps dial values to angles and back', () => {
    expect(dialAngle(0, 1000)).toBe(-150);
    expect(dialAngle(500, 1000)).toBe(0);
    expect(dialAngle(1000, 1000)).toBe(150);
    expect(dialAngle(2000, 1000)).toBe(150);
    expect(dialValue(0, 1000)).toBe(500);
    expect(dialValue(-150, 1000)).toBe(0);
    expect(dialValue(170, 1000)).toBe(1000);
  });
});

describe('length-tool layout', () => {
  it('finds the furthest end of objects that start at different places', () => {
    expect(furthestEnd([{ length: 5 }, { length: 4, at: 2 }])).toBe(6);
    expect(furthestEnd([{ length: 7 }])).toBe(7);
  });
  it('gives a circle a row as tall as its diameter', () => {
    expect(objectRow('pencil', 200)).toBe(36);
    expect(objectRow('circle', 150)).toBe(162);
    expect(objectRow('circle', 10)).toBe(36);
  });
});
