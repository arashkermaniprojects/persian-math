import { describe, expect, it } from 'vitest';
import { circum, dpOf, Figure, incircle, reading, readings, term, type DynamicConfig } from './shape-board-dynamic';
import type { P } from './shape-board-geom';

const close = (p: P | null | undefined, q: P) => {
  expect(p).toBeTruthy();
  expect(p![0]).toBeCloseTo(q[0], 6);
  expect(p![1]).toBeCloseTo(q[1], 6);
};

/** The pilot's figure: AB ∥ CD, transversal through E on AB and the turn handle H; F where it meets CD. */
const parallels: DynamicConfig = {
  points: {
    A: [1, 4], B: [7, 4],
    C: { on: { through: 'A', perp: 'A B' }, at: [1, 1.5] },
    D: { add: 'C A B' },
    E: { on: 'A B', at: [3, 4] },
    H: { on: { centre: 'E', r: 1.5 }, deg: 60, range: [30, 150], hide: true },
    F: { meet: ['E H', 'C D'] },
    Er: { add: 'E A B', hide: true },
    Fr: { add: 'F C D', hide: true }, // along CD itself, so the angle is right when CD is not parallel
    Fu: { add: 'F E H', hide: true },
    El: { add: 'E B A', hide: true },
    Ed: { add: 'E H E', hide: true },
  },
  drag: ['B', 'C', 'E', 'H'],
  watch: [
    { key: 'a2', angle: 'H E Er' },
    { key: 'a6', angle: 'Fu F Fr' },
    { key: 'a3', angle: 'Er E Ed' },
    { key: 'co', sum: ['H E Er', 'Ed E Er'] },
  ],
};

describe('Figure: building points', () => {
  it('free points, gliders on lines and circles, translations and crossings', () => {
    const f = new Figure(parallels), p = f.solve();
    close(p.C, [1, 1.5]);
    close(p.D, [7, 1.5]);
    close(p.E, [3, 4]);
    close(p.H, [3 + 0.75, 4 + 1.5 * Math.sin(Math.PI / 3)]);
    // F is on CD and on line EH
    expect(p.F![1]).toBeCloseTo(1.5, 9);
    close(p.F, [3 - 2.5 / Math.tan(Math.PI / 3), 1.5]);
    close(p.Ed, [3 - 0.75, 4 - 1.5 * Math.sin(Math.PI / 3)]);
  });
  it('built points follow when a point they hang on moves (constructions stay attached)', () => {
    const f = new Figure(parallels);
    f.solve();
    f.moveTo('E', [5.2, 4.3], 0.5); // slides along AB, snapped to half units
    let p = f.solve();
    close(p.E, [5, 4]);
    close(p.H, [5.75, 4 + 1.5 * Math.sin(Math.PI / 3)]);
    f.moveTo('C', [3, 2.6], 0.5); // C glides on the perpendicular through A: only its height changes
    p = f.solve();
    close(p.C, [1, 2.5]);
    close(p.D, [7, 2.5]);
    expect(p.F![1]).toBeCloseTo(2.5, 9);
  });
  it('a circle glider snaps to its angle step and stays in its range', () => {
    const f = new Figure(parallels);
    f.solve();
    f.moveTo('H', [3 + Math.cos(1.25), 4 + Math.sin(1.25)], 0.5); // 71.6° → 70°
    expect(f.par.H).toBe(70);
    f.moveTo('H', [4, 3.9], 0.5); // −5.7° → kept at 30°
    expect(f.par.H).toBe(30);
    f.moveTo('H', [2, 3.9], 0.5); // 185.7° → kept at 150°
    expect(f.par.H).toBe(150);
  });
  it('the readouts: corresponding and alternate angles equal, co-interior angles add to 180', () => {
    const f = new Figure(parallels);
    for (const d of [60, 35, 120, 145]) {
      f.par.H = d;
      const r = readings(parallels.watch, f.solve());
      expect(r.a2).toBe(d);
      expect(r.a6).toBe(d);
      expect(r.co).toBe(180);
    }
  });
  it('segments and rays clamp a glider; nudges step it along', () => {
    const f = new Figure({ points: { A: [0, 0], B: [4, 0], P: { on: 'A B', clamp: 'segment', at: [1, 0] }, Q: { on: 'A B', clamp: 'ray', at: [1, 0] } } });
    f.solve();
    f.moveTo('P', [9, 1], 1);
    f.moveTo('Q', [9, 1], 1);
    let p = f.solve();
    close(p.P, [4, 0]);
    close(p.Q, [9, 0]);
    f.moveTo('P', [-3, 0], 1);
    f.moveTo('Q', [-3, 0], 1);
    p = f.solve();
    close(p.P, [0, 0]);
    close(p.Q, [0, 0]);
    f.nudge('P', 1, 0, 0.5);
    close(f.solve().P, [0.5, 0]);
    f.nudge('P', 0, -1, 0.5);
    close(f.solve().P, [0, 0]);
  });
  it('a free point nudges by the step', () => {
    const f = new Figure({ points: { A: [1, 1] } });
    f.solve();
    f.nudge('A', 0, 1, 0.5);
    close(f.solve().A, [1, 1.5]);
  });
  it('midpoints, ratios, feet, bisectors and fixed directions', () => {
    const f = new Figure({
      points: {
        A: [0, 0], B: [4, 0], C: [0, 3],
        M: { mid: 'B C' },
        R: { ratio: ['A', 'B', 0.25] },
        F: { foot: ['C', 'B A'] },
        I: { meet: [{ bisector: 'B A C' }, { bisector: 'A B C' }] },
        O: { meet: [{ bisect: 'A B' }, { bisect: 'A C' }] },
        T: { meet: [{ through: 'A', deg: 45 }, 'B C'] },
        K: { meet: [{ through: 'C', parallel: 'A B' }, { through: 'B', perp: 'A B' }] },
      },
    });
    const p = f.solve();
    close(p.M, [2, 1.5]);
    close(p.R, [1, 0]);
    close(p.F, [0, 0]);
    close(p.I, [1, 1]); // 3-4-5 triangle: inradius 1
    close(p.O, [2, 1.5]); // circumcentre of a right triangle: the midpoint of the hypotenuse
    close(p.T, [12 / 7, 12 / 7]);
    close(p.K, [4, 3]);
  });
  it('parallel lines do not meet; a loop in the definitions gives null, not a hang', () => {
    const f = new Figure({ points: { A: [0, 0], B: [1, 0], C: [0, 1], D: [1, 1], X: { meet: ['A B', 'C D'] }, Y: { mid: 'Y A' } } });
    const p = f.solve();
    expect(p.X).toBeNull();
    expect(p.Y).toBeNull();
  });
  it('circles: centre + radius, centre + point, circumcircle, incircle, and their crossings', () => {
    expect(circum([0, 0], [4, 0], [0, 3])).toEqual([2, 1.5, 2.5]);
    expect(circum([0, 0], [1, 1], [2, 2])).toBeNull();
    const ic = incircle([0, 0], [4, 0], [0, 3])!;
    expect(ic.map((v) => +v.toFixed(9))).toEqual([1, 1, 1]);
    const f = new Figure({
      points: {
        O: [0, 0], A: [5, 0], B: [3, 4], X: [10, 0],
        P: { meet: [{ centre: 'O', through: 'A' }, { centre: 'X', r: 5 }] },
        Q: { meet: ['O B', { centre: 'O', r: 5 }], n: 1 },
        Z: { meet: [{ centre: 'O', r: 1 }, { centre: 'X', r: 1 }] },
        G: { centre: { circum: 'O A B' } },
        T: { on: { centre: 'O', through: 'A' }, deg: 90 },
      },
    });
    const p = f.solve();
    close(p.P, [5, 0]); // the circles touch
    close(p.Q, [3, 4]);
    expect(p.Z).toBeNull(); // too far apart (the triangle inequality: the sticks do not reach)
    expect(p.G![0]).toBeCloseTo(2.5, 9);
    close(p.T, [0, 5]);
  });
  it('lock: built points set free stay put, can be dragged, and snap back when locked again', () => {
    const f = new Figure({ ...parallels, lock: ['D'] });
    f.solve();
    expect(f.locked).toBe(true);
    f.setLocked(false);
    expect(f.locked).toBe(false);
    f.moveTo('D', [7, 2.1], 0.5);
    let p = f.solve();
    close(p.D, [7, 2]);
    const r = readings(parallels.watch, p);
    expect(r.a2).not.toBe(r.a6); // not parallel: corresponding angles differ
    const snap = f.snapshot();
    f.setLocked(true);
    p = f.solve();
    close(p.D, [7, 1.5]);
    f.restore(snap);
    close(f.solve().D, [7, 2]);
  });
});

describe('readouts', () => {
  const pts = { A: [0, 0] as P, B: [4, 0] as P, C: [0, 3] as P, X: null };
  it('terms: lengths, angles, numbers, minus', () => {
    expect(term('A B', pts)).toBe(4);
    expect(term('B A C', pts)).toBeCloseTo(90, 9);
    expect(term('-B A C', pts)).toBeCloseTo(-90, 9);
    expect(term(180, pts)).toBe(180);
    expect(term('A X', pts)).toBeNull();
  });
  it('angles, lengths, sums, ratios, products and trig ratios, rounded as shown', () => {
    expect(reading({ key: 'a', angle: 'A B C' }, pts)).toBe(37);
    expect(reading({ key: 'l', length: 'B C' }, pts)).toBe(5);
    expect(reading({ key: 's', sum: ['C A B', 'A B C', 'B C A'] }, pts)).toBe(180);
    expect(reading({ key: 'x', sum: [180, '-C A B'] }, pts)).toBe(90);
    expect(reading({ key: 't', sum: ['A B', 'A C', '-B C'] }, pts)).toBe(2); // triangle inequality: 4 + 3 − 5
    expect(reading({ key: 'r', ratio: ['A C', 'B C'] }, pts)).toBe(0.6);
    expect(reading({ key: 'p', product: ['A B', 'A C'] }, pts)).toBe(12);
    expect(reading({ key: 'sin', sin: 'A B C' }, pts)).toBe(0.6);
    expect(reading({ key: 'cos', cos: 'A B C' }, pts)).toBe(0.8);
    expect(reading({ key: 'tan', tan: 'A B C' }, pts)).toBe(0.75);
    expect(reading({ key: 'tan90', tan: 'B A C' }, pts)).toBeNull();
    expect(reading({ key: 'r0', ratio: ['A B', 0] }, pts)).toBeNull();
    expect(reading({ key: 'n', length: 'A X' }, pts)).toBeNull();
    expect(reading({ key: 'dp', angle: 'A B C', dp: 1 }, pts)).toBe(36.9);
  });
  it('decimal places by kind', () => {
    expect(dpOf({ key: 'a', angle: 'A B C' })).toBe(0);
    expect(dpOf({ key: 'a', sum: ['A B C', 180] })).toBe(0);
    expect(dpOf({ key: 'a', sum: ['A B', 'B C'] })).toBe(1);
    expect(dpOf({ key: 'a', length: 'A B' })).toBe(1);
    expect(dpOf({ key: 'a', ratio: ['A B', 'B C'] })).toBe(2);
    expect(dpOf({ key: 'a', ratio: ['A B', 'B C'], dp: 1 })).toBe(1);
  });
  it('Thales: a line parallel to a side cuts the other two in the same ratio, wherever D slides', () => {
    const cfg: DynamicConfig = {
      points: {
        A: [2, 5], B: [0, 0], C: [6, 0],
        D: { on: 'A B', clamp: 'segment', at: [1, 2.5] },
        E: { meet: [{ through: 'D', parallel: 'B C' }, 'A C'] },
      },
      watch: [{ key: 'ad', ratio: ['A D', 'D B'] }, { key: 'ae', ratio: ['A E', 'E C'] }, { key: 'pw', ratio: ['A D', 'A B'] }],
    };
    const f = new Figure(cfg);
    for (const t of [1, 2, 3.5]) {
      f.par.D = t;
      const r = readings(cfg.watch, f.solve());
      expect(r.ad).toBe(r.ae);
      expect(r.pw).not.toBe(r.ad);
    }
  });
  it('the inscribed angle is half the central angle, wherever P goes on the major arc', () => {
    const cfg: DynamicConfig = {
      points: { O: [0, 0], A: { on: { centre: 'O', r: 3 }, deg: -30 }, B: { on: { centre: 'O', r: 3 }, deg: 50 }, P: { on: { centre: 'O', r: 3 }, deg: 170 } },
      watch: [{ key: 'in', angle: 'A P B' }, { key: 'c', angle: 'A O B' }],
    };
    const f = new Figure(cfg);
    for (const d of [120, 170, 220, 260]) {
      f.par.P = d;
      const r = readings(cfg.watch, f.solve());
      expect(r.c).toBe(80);
      expect(r.in).toBe(40);
    }
  });
  it('intersecting chords: AP·PB = CP·PD', () => {
    const cfg: DynamicConfig = {
      points: {
        O: [0, 0], A: { on: { centre: 'O', r: 3 }, deg: 160 }, B: { on: { centre: 'O', r: 3 }, deg: -10 },
        C: { on: { centre: 'O', r: 3 }, deg: 250 }, D: { on: { centre: 'O', r: 3 }, deg: 80 }, P: { meet: ['A B', 'C D'] },
      },
      watch: [{ key: 'ab', product: ['A P', 'P B'] }, { key: 'cd', product: ['C P', 'P D'] }],
    };
    const r = readings(cfg.watch, new Figure(cfg).solve());
    expect(r.ab).toBe(r.cd);
  });
  it('trig: sin 35° is the same in every right triangle with a 35° angle', () => {
    const cfg: DynamicConfig = {
      points: { A: [0, 0], X: [1, 0], B: { on: 'A X', clamp: 'ray', at: [3, 0] }, C: { meet: [{ through: 'A', deg: 35 }, { through: 'B', perp: 'A B' }] } },
      watch: [{ key: 's', ratio: ['B C', 'A C'] }, { key: 'sin', sin: 'B A C' }, { key: 'h', length: 'A C' }],
    };
    const f = new Figure(cfg);
    const hs = new Set<number | null>();
    for (const t of [2, 4, 6.5]) {
      f.par.B = t;
      const r = readings(cfg.watch, f.solve());
      expect(r.s).toBe(0.57);
      expect(r.sin).toBe(0.57);
      hs.add(r.h);
    }
    expect(hs.size).toBe(3);
  });
});
