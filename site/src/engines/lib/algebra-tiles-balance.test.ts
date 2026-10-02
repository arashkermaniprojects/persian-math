import { describe, expect, it } from 'vitest';
import {
  aloneCode, applyOp, judge, move, opText, panText, parseScale, parseSide, ratio, readAlone, sameScale, scaleText, termText,
  tiltOf, valueOf, weightsOf, type Op, type Scale,
} from './algebra-tiles-balance';
import { checkAlgebra, type AlgebraCheck, type AlgebraState } from './algebra-tiles-check';
import { parse } from './algebra-tiles-poly';
import { algHTML } from '../../lib/display';

const ops = (s: Scale, list: [Op, 0 | 1 | 'both'][]) => list.reduce((x, [o, w]) => move(x, o, w), s);
const take = (k: string, n = 1): Op => ({ op: 'add', q: { [k]: -n } });
const put = (k: string, n = 1): Op => ({ op: 'add', q: { [k]: n } });
const div = (k: number | string): Op => ({ op: 'div', k });
const mul = (k: number | string): Op => ({ op: 'mul', k });

describe('reading an equation onto the pans', () => {
  it('reads sides, groups and thirds', () => {
    const s = parseScale('5x - 3 = 2x + 12');
    expect(s.rel).toBe('=');
    expect(s.pans[0]).toEqual({ p: { x: 5, '1': -3 }, n: 1, den: '1' });
    expect(parseSide('2(x + 3)')).toEqual({ p: { x: 1, '1': 3 }, n: 2, den: '1' });
    expect(parseSide('x/3 + 1').p.x).toBeCloseTo(1 / 3);
    expect(parseScale('2x + 1 ≥ 7').rel).toBe('>=');
    expect(parseScale('v = u + at').pans[1].p).toEqual({ u: 1, 'a*t': 1 });
    expect(() => parseScale('x + 1')).toThrow();
  });
  it('the poly parser divides by a number, never by a letter', () => {
    expect(parse('(x + 1)/2')).toEqual({ x: 0.5, '1': 0.5 });
    expect(parse('x/a')).toBeNull();
  });
  it('writes pans with stacked-fraction text', () => {
    expect(termText('x', 1 / 3)).toBe('x/3');
    expect(termText('x', -2 / 3)).toBe('-2x/3');
    expect(termText('1', 4 / 3)).toBe('4/3');
    expect(termText('a*t', 2)).toBe('2at');
    expect(panText(parseSide('2(x + 3)'))).toBe('2(x + 3)');
    expect(scaleText(parseScale('x/3 + 1 = 5'))).toBe('x/3 + 1 = 5');
    expect(opText(take('1', 2))).toBe('-2');
    expect(opText(put('x'))).toBe('+x');
    expect(opText(div(-3))).toBe('÷(-3)');
    expect(opText(div('a'))).toBe('÷a');
  });
  it('algHTML stacks a/b and spaces ≠', () => {
    expect(algHTML('x/3 + 1')).toBe('<bdi dir="ltr" class="alg"><span class="frac"><span class="frac-n">x</span><span class="frac-d">3</span></span> + 1</bdi>');
    expect(algHTML('(v - u)/a', '۰۱۲۳۴۵۶۷۸۹')).toContain('<span class="frac-n">v − u</span><span class="frac-d">a</span>');
    expect(algHTML('3x + 2 ≠ 14', '۰۱۲۳۴۵۶۷۸۹')).toBe('<bdi dir="ltr" class="alg">۳x + ۲ ≠ ۱۴</bdi>');
    expect(algHTML('x^2 - 1')).toBe('<bdi dir="ltr" class="alg">x<sup>2</sup> − 1</bdi>'); // unchanged without "/"
  });
});

describe('moves', () => {
  it('3x + 2 = 14: −2 on both pans, ÷3 → x = 4, level all the way', () => {
    const s0 = parseScale('3x + 2 = 14');
    const s1 = ops(s0, [[take('1', 2), 'both']]);
    expect(scaleText(s1)).toBe('3x = 12');
    expect(judge(s1, s0).ok).toBe(true);
    const s2 = move(s1, div(3), 'both');
    expect(scaleText(s2)).toBe('x = 4');
    expect(judge(s2, s0).ok).toBe(true);
    expect(aloneCode(s2, 'x')).toBeNull();
  });
  it('a move on one pan tips the scale; the same on the other pan levels it', () => {
    const s0 = parseScale('3x + 2 = 14'), w = weightsOf(s0)!;
    expect(w).toEqual({ x: 4 });
    const s1 = move(s0, take('1'), 0);
    expect(judge(s1, s0).ok).toBe(false);
    expect(tiltOf(s1, false, w)).toBe(-1); // 13 < 14: the right pan goes down
    const s2 = move(s1, take('1'), 1);
    expect(judge(s2, s0).ok).toBe(true);
    expect(tiltOf(s2, true, w)).toBe(0);
    // 3x = 12, dividing only the left pan: x = 12 is heavier on the right
    const s3 = move(parseScale('3x = 12'), div(3), 0);
    expect(scaleText(s3)).toBe('x = 12');
    expect(judge(s3, parseScale('3x = 12')).ok).toBe(false);
  });
  it('5x − 3 = 2x + 12: add 3, take 2x, ÷3; zero pairs cancel at once', () => {
    const s0 = parseScale('5x - 3 = 2x + 12');
    const s = ops(s0, [[put('1', 3), 'both'], [take('x', 2), 'both']]);
    expect(scaleText(s)).toBe('3x = 15');
    expect(scaleText(move(s, div(3), 'both'))).toBe('x = 5');
    // collecting onto the other side works too: −5x gives −3 = −3x + 12 … −x = −5, then × −1
    const t = ops(s0, [[take('x', 5), 'both'], [take('1', 12), 'both'], [div(3), 'both']]);
    expect(scaleText(t)).toBe('-5 = -x');
    expect(aloneCode(t, 'x')).toBe('negative-unknown');
    expect(scaleText(move(t, mul(-1), 'both'))).toBe('5 = x');
    expect(aloneCode(move(t, mul(-1), 'both'), 'x')).toBeNull();
  });
  it('x/3 + 1 = 5: ×3 undoes the thirds; ÷3 makes ninths', () => {
    const s0 = parseScale('x/3 + 1 = 5');
    const s1 = move(s0, take('1'), 'both');
    expect(scaleText(s1)).toBe('x/3 = 4');
    expect(aloneCode(s1, 'x')).toBe('fraction-left');
    expect(scaleText(move(s1, mul(3), 'both'))).toBe('x = 12');
    const wrong = move(s1, div(3), 'both');
    expect(scaleText(wrong)).toBe('x/9 = 4/3');
    expect(judge(wrong, s0).ok).toBe(true);
    // multiplying first: both terms of the left pan are multiplied
    expect(scaleText(move(s0, mul(3), 'both'))).toBe('x + 3 = 15');
  });
  it('2(x + 3) = 16: ÷2 keeps one group; opening the brackets gives 2x + 6', () => {
    const s0 = parseScale('2(x + 3) = 16');
    expect(aloneCode(s0, 'x')).toBe('bracket-left');
    const a = move(s0, div(2), 'both');
    expect(scaleText(a)).toBe('x + 3 = 8');
    expect(aloneCode(a, 'x')).toBe('constant-left');
    const b = { ...s0, pans: s0.pans.map((p) => applyOp(p, { op: 'expand' })) as Scale['pans'] };
    expect(scaleText(b)).toBe('2x + 6 = 16');
    expect(judge(b, s0).ok).toBe(true);
    expect(scaleText(move(s0, take('1'), 'both'))).toBe('2x + 5 = 15'); // a tile opens the brackets first
    expect(scaleText(move(s0, mul(3), 'both'))).toBe('6(x + 3) = 48');
    expect(scaleText(move(s0, div(4), 'both'))).toBe('x/2 + 3/2 = 4');
  });
  it('v = u + at → t = (v − u)/a, with letters as tiles', () => {
    const s0 = parseScale('v = u + at');
    expect(weightsOf(s0)).toBeNull();
    const s1 = move(s0, take('u'), 'both');
    expect(scaleText(s1)).toBe('v - u = at');
    expect(aloneCode(s1, 't')).toBe('coefficient-left');
    const s2 = move(s1, div('a'), 'both');
    expect(scaleText(s2)).toBe('(v - u)/a = t');
    expect(judge(s2, s0).ok).toBe(true);
    expect(aloneCode(s2, 't')).toBeNull();
    expect(panText(readAlone(s2, 't').other)).toBe('(v - u)/a');
    // ÷ a on one pan only: not the same formula
    expect(judge(move(s1, div('a'), 1), s0).ok).toBe(false);
    // × a cancels the bar again
    expect(scaleText(move(s2, mul('a'), 'both'))).toBe('v - u = at');
    const w = { u: 2, a: 3, t: 4, v: 14 };
    expect(valueOf(s2.pans[0], w)).toBe(4);
    expect(tiltOf(move(s1, div('a'), 1), false, w)).toBe(1);
  });
  it('ratio: a multiple by a number and a monomial', () => {
    expect(ratio({ x: 2, '1': -8 }, { x: 1, '1': -4 })).toBe(2);
    expect(ratio({ x: -1, '1': 4 }, { x: 1, '1': -4 })).toBe(-1);
    expect(ratio({ 'a*x': 1, a: 2 }, { x: 1, '1': 2 })).toBe(1);
    expect(ratio({ x: 1, '1': 2 }, { 'a*x': 1, a: 2 })).toBe(1);
    expect(ratio({ x: 1, '1': -3 }, { x: 1, '1': -4 })).toBeNull();
    expect(ratio({}, { x: 1 })).toBeNull();
  });
});

describe('inequalities', () => {
  const s0 = parseScale('-2x + 1 > 7');
  it('× or ÷ a negative turns the relation; judge says which it must be', () => {
    const s1 = move(s0, take('1'), 'both');
    expect(scaleText(s1)).toBe('-2x > 6');
    expect(judge(s1, s0).ok).toBe(true);
    expect(tiltOf(s1, true, null)).toBe(1);
    const s2 = move(s1, div(-2), 'both');
    expect(scaleText(s2)).toBe('x > -3'); // the sign not turned yet
    const j = judge(s2, s0);
    expect(j).toEqual({ same: true, rel: '<', ok: false });
    expect(judge({ ...s2, rel: '<' }, s0).ok).toBe(true);
    expect(tiltOf({ ...s2, rel: '<' }, true, null)).toBe(-1);
  });
});

const st = (s: Scale, extra: Partial<AlgebraState> = {}, first?: Scale): { algebra: AlgebraState } => {
  const j = judge(s, first ?? s);
  return { algebra: { mode: 'balance', pans: s.pans, rel: s.rel, level: j.ok, turned: j.same && !j.ok, ...extra } };
};
const chk = (c: Omit<AlgebraCheck, 'type'>, s: { algebra: AlgebraState }) => checkAlgebra({ type: 'algebra', ...c }, s).code ?? 'ok';

describe('the algebra check: solution and subject', () => {
  const s0 = parseScale('3x + 2 = 14');
  it('passes when x is alone and the scale is level', () => {
    expect(chk({ solution: 4 }, st(parseScale('x = 4'), {}, s0))).toBe('ok');
    expect(chk({ solution: 'x = 4' }, st(parseScale('4 = x'), {}, s0))).toBe('ok');
    expect(chk({ solution: '4' }, st(parseScale('x = 4'), {}, s0))).toBe('ok');
  });
  it('codes for a tipped scale and for every way x is not alone yet', () => {
    expect(chk({ solution: 4 }, { algebra: { mode: 'balance' } })).toBe('empty');
    expect(chk({ solution: 4 }, st(parseScale('3x = 14'), {}, s0))).toBe('one-pan');
    expect(chk({ solution: 4 }, st(s0))).toBe('constant-left');
    expect(chk({ solution: 4 }, st(parseScale('3x = 12'), {}, s0))).toBe('coefficient-left');
    expect(chk({ solution: 4 }, st(parseScale('3x - 3 = 9'), {}, s0))).toBe('constant-left');
    expect(chk({ solution: 5 }, st(parseScale('5x - 3 = 2x + 12')))).toBe('unknown-both-sides');
    expect(chk({ solution: 5 }, st(parseScale('-x = -5'), {}, parseScale('5x - 3 = 2x + 12')))).toBe('negative-unknown');
    expect(chk({ solution: 12 }, st(parseScale('x/9 = 4/3'), {}, parseScale('x/3 + 1 = 5')))).toBe('fraction-left');
    expect(chk({ solution: 5 }, st(parseScale('2(x + 3) = 16')))).toBe('bracket-left');
    expect(chk({ solution: 5 }, st(parseScale('x = 4')))).toBe('wrong-solution'); // only when the start was x = 4 itself
  });
  it('a scale trap and a written prediction come first', () => {
    const s = st(parseScale('x/9 = 4/3'), { written: '9' }, parseScale('x/3 + 1 = 5'));
    const traps = [{ scale: '4/3 = x/9', code: 'divided-not-multiplied' }, { write: '9', code: 'subtracted' }];
    expect(chk({ solution: 12, traps }, s)).toBe('divided-not-multiplied');
    expect(chk({ written: '12', solution: 12, traps }, s)).toBe('subtracted');
    expect(chk({ written: '12', solution: 12, traps }, { algebra: { ...s.algebra, written: '12' } })).toBe('divided-not-multiplied');
  });
  it('try mode: the value on the tiles must balance', () => {
    const t = (v: number | null) => ({ algebra: { mode: 'balance', pans: s0.pans, rel: '=' as const, level: true, tried: v } });
    expect(chk({ solution: 4 }, t(4))).toBe('ok');
    expect(chk({ solution: 4 }, t(5))).toBe('too-big');
    expect(chk({ solution: 4 }, t(2))).toBe('too-small');
    expect(chk({ solution: 4 }, t(null))).toBe('not-tried');
    expect(chk({ solution: 4, traps: [{ try: 5, code: 'sara' }] }, t(5))).toBe('sara');
    expect(chk({ solution: 0 }, t(0))).toBe('ok');
  });
  it('inequalities: the sign must be turned, and is read with x on the left', () => {
    const f = parseScale('-2x + 1 > 7');
    expect(chk({ solution: 'x < -3' }, st(parseScale('x < -3'), {}, f))).toBe('ok');
    expect(chk({ solution: 'x < -3' }, st(parseScale('-3 > x'), {}, f))).toBe('ok');
    expect(chk({ solution: 'x < -3' }, st(parseScale('x > -3'), {}, f))).toBe('sign-flip-missed');
    expect(chk({ solution: 'x < -3' }, st(parseScale('x + 1 > 5'), {}, f))).toBe('one-pan');
    expect(chk({ solution: 'x < -3' }, st(parseScale('x + 1 > -2'), {}, f))).toBe('sign-flip-missed'); // same as −2x − 2 < 4, sign not turned
  });
  it('subject: t alone, level', () => {
    const f = parseScale('v = u + at');
    expect(chk({ subject: 't' }, st(move(move(f, take('u'), 'both'), div('a'), 'both'), {}, f))).toBe('ok');
    expect(chk({ subject: 't' }, st(move(f, take('u'), 'both'), {}, f))).toBe('coefficient-left');
    expect(chk({ subject: 't' }, st(move(move(f, take('u'), 'both'), div('a'), 1), {}, f))).toBe('one-pan');
    expect(sameScale(parseScale('x = 4'), parseScale('4 = x'))).toBe(true);
  });
  it('without solution or subject, the balance part is silent (existing missions unchanged)', () => {
    expect(chk({ expr: '2x + 3' }, { algebra: { mode: 'tiles', mat: [{ kind: 'x', sign: 1 }, { kind: 'x', sign: 1 }, { kind: '1', sign: 1 }, { kind: '1', sign: 1 }, { kind: '1', sign: 1 }] } })).toBe('ok');
  });
});
