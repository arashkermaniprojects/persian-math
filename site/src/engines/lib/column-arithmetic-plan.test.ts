import { describe, expect, it } from 'vitest';
import { borrowFrom, diagnose, inverse, parseNum, plan, subDigit, tapBorrow, type Cell, type Plan } from './column-arithmetic-plan';

const row = (p: Plan, r: string) => p.cells.filter((c) => c.row === r);
/** Digits of a row as a string, most significant first. */
const read = (p: Plan, r: string) => row(p, r).slice().sort((a, b) => b.col - a.col).map((c) => c.want).join('');
const cell = (p: Plan, r: string, col: number) => p.cells.find((c) => c.row === r && c.col === col)!;

describe('parseNum', () => {
  it('reads whole numbers and decimals, least significant digit first', () => {
    expect(parseNum(305)).toEqual({ ds: [5, 0, 3], scale: 0 });
    expect(parseNum('12.50')).toEqual({ ds: [0, 5, 2, 1], scale: 2 });
    expect(parseNum(0.5)).toEqual({ ds: [5, 0], scale: 1 });
    expect(parseNum('007')).toEqual({ ds: [7], scale: 0 });
  });
  it('rejects anything that is not a plain non-negative number', () => {
    expect(() => parseNum('-3')).toThrow();
    expect(() => parseNum('1,5')).toThrow();
    expect(() => parseNum('')).toThrow();
  });
});

describe('addition', () => {
  it('58 + 27: one carry into the tens, written in the carry row', () => {
    const p = plan('add', [58, 27]);
    expect(p.answer).toBe('85');
    expect(read(p, 'r')).toBe('85');
    expect(row(p, 'c')).toEqual([{ row: 'c', col: 1, want: 1, step: 0, kind: 'c', s: 15 }]);
    expect(p.steps).toBe(2);
    expect(cell(p, 'r', 0).expr).toBe('8 + 7');
    expect(cell(p, 'r', 1).expr).toBe('5 + 2 + 1');
  });
  it('the last carry goes straight into the answer, with no carry box', () => {
    const p = plan('add', [368, 857]);
    expect(p.answer).toBe('1225');
    expect(row(p, 'c').map((c) => c.col)).toEqual([1, 2]);
    expect(cell(p, 'r', 3)).toMatchObject({ want: 1, kind: 'd', step: 3 });
    expect(p.width).toBe(4);
    expect(p.steps).toBe(4);
  });
  it('no carries: one step per column', () => {
    const p = plan('add', [4735, 2231]);
    expect(p.answer).toBe('6966');
    expect(row(p, 'c')).toHaveLength(0);
    expect(p.steps).toBe(4);
  });
  it('three addends can carry 2', () => {
    const p = plan('add', [99, 99, 99]);
    expect(p.answer).toBe('297');
    expect(cell(p, 'c', 1)).toMatchObject({ want: 2, s: 27 });
    expect(cell(p, 'r', 1).expr).toBe('9 + 9 + 9 + 2');
  });
  it('knows the forgotten carry and the tens-instead-of-ones mistakes', () => {
    const p = plan('add', [58, 27]);
    expect(diagnose(cell(p, 'r', 0), 1)).toBe('tens-digit'); // 8 + 7 = 15: wrote the 1
    expect(diagnose(cell(p, 'r', 1), 7)).toBe('forgot-carry'); // 5 + 2 without the carried 1
    expect(diagnose(cell(p, 'r', 1), 4)).toBe('wrong');
  });
  it('lines up decimal marks and pads the shorter decimal with zeros', () => {
    const p = plan('add', ['12.5', '3.75']);
    expect(p.answer).toBe('16.25');
    expect(p.scale).toBe(2);
    expect(p.ones).toBe(2);
    expect(p.operands[0]).toEqual({ ds: [0, 5, 2, 1], pad: [true, false, false, false], mark: 2 });
    expect(p.operands[1]).toEqual({ ds: [5, 7, 3], pad: [false, false, false], mark: 2 });
  });
  it('a decimal sum that ends in zeros keeps them', () => {
    expect(plan('add', ['0.75', '0.25']).answer).toBe('1.00');
  });
});

describe('subtraction', () => {
  it('52 − 27: one borrow', () => {
    const p = plan('sub', [52, 27]);
    expect(p.answer).toBe('25');
    expect(p.top).toEqual([2, 5]);
    expect(p.bottom).toEqual([7, 2]);
    expect(row(p, 'r').map((c) => c.want)).toEqual([5, 2]);
  });
  it('403 − 168: borrowing through a zero', () => {
    const p = plan('sub', [403, 168]);
    expect(p.answer).toBe('235');
    const vals = p.top!.slice();
    expect(borrowFrom(vals, p.bottom!, 0)).toBe(2); // the tens are 0: borrow from the hundreds
    expect(tapBorrow(vals, p.bottom!, 0, 1)).toBe('borrow-zero');
    expect(tapBorrow(vals, p.bottom!, 0, 2)).toBeNull();
    expect(vals).toEqual([3, 10, 3]);
    expect(tapBorrow(vals, p.bottom!, 0, 1)).toBeNull();
    expect(vals).toEqual([13, 9, 3]);
    expect(tapBorrow(vals, p.bottom!, 0, 1)).toBe('no-borrow'); // 13 ≥ 8 now
    expect(subDigit(vals, p.top!, p.bottom!, 0, 5)).toEqual({ ok: true });
    expect(subDigit(vals, p.top!, p.bottom!, 1, 3)).toEqual({ ok: true }); // 9 − 6
    expect(subDigit(vals, p.top!, p.bottom!, 2, 2)).toEqual({ ok: true }); // 3 − 1
  });
  it('refuses a borrow that is not needed, or from too far left', () => {
    const p = plan('sub', [745, 312]);
    const vals = p.top!.slice();
    expect(tapBorrow(vals, p.bottom!, 0, 1)).toBe('no-borrow');
    const q = plan('sub', [742, 318]);
    const v2 = q.top!.slice();
    expect(tapBorrow(v2, q.bottom!, 0, 2)).toBe('too-far');
    expect(tapBorrow(v2, q.bottom!, 0, 0)).toBe('no-borrow');
    expect(v2).toEqual(q.top);
  });
  it('spots taking the smaller digit from the larger one', () => {
    const p = plan('sub', [52, 27]);
    const vals = p.top!.slice();
    expect(subDigit(vals, p.top!, p.bottom!, 0, 5)).toEqual({ ok: false, code: 'smaller-from-larger' }); // 7 − 2
    expect(subDigit(vals, p.top!, p.bottom!, 0, 5).ok).toBe(false);
  });
  it('a right digit without the written borrow asks for the borrow mark', () => {
    const p = plan('sub', [61, 27]);
    expect(subDigit(p.top!.slice(), p.top!, p.bottom!, 0, 4)).toEqual({ ok: false, code: 'mark-borrow' }); // 11 − 7
  });
  it('spots using the digit from before it lent', () => {
    const p = plan('sub', [52, 27]);
    const vals = p.top!.slice();
    tapBorrow(vals, p.bottom!, 0, 1);
    expect(vals).toEqual([12, 4]);
    expect(subDigit(vals, p.top!, p.bottom!, 1, 3)).toEqual({ ok: false, code: 'old-digit' }); // 5 − 2
    expect(subDigit(vals, p.top!, p.bottom!, 1, 2)).toEqual({ ok: true });
  });
  it('leading zeros of the answer get no box', () => {
    const p = plan('sub', [523, 498]);
    expect(p.answer).toBe('25');
    expect(row(p, 'r').map((c) => c.col)).toEqual([0, 1]);
    expect(p.steps).toBe(2);
    expect(plan('sub', [1000, 1]).answer).toBe('999');
    expect(plan('sub', [7, 7]).answer).toBe('0');
  });
  it('decimals: the top number is padded with zeros that can lend', () => {
    const p = plan('sub', ['5', '2.35']);
    expect(p.answer).toBe('2.65');
    expect(p.top).toEqual([0, 0, 5]);
    expect(p.operands[0].pad).toEqual([true, true, false]);
    expect(plan('sub', ['5.00', '4.65']).answer).toBe('0.35'); // keeps the 0 in the ones
  });
  it('refuses a negative answer', () => {
    expect(() => plan('sub', [27, 52])).toThrow();
    expect(() => plan('sub', [1, 2, 3])).toThrow();
  });
});

describe('multiplication', () => {
  it('short multiplication 247 × 3 with carries', () => {
    const p = plan('mul', [247, 3]);
    expect(p.answer).toBe('741');
    expect(p.partials).toEqual([{ row: 'r', m: 3, j: 0 }]);
    expect(read(p, 'r')).toBe('741');
    expect(row(p, 'c').map((c) => [c.col, c.want])).toEqual([[1, 2], [2, 1]]);
    expect(cell(p, 'r', 1).expr).toBe('4 × 3 + 2');
  });
  it('knows the multiplication carry mistakes', () => {
    const p = plan('mul', [247, 3]);
    const tens = cell(p, 'r', 1); // 4 × 3 + 2 = 14
    expect(diagnose(tens, 2)).toBe('forgot-carry'); // 12
    expect(diagnose(tens, 8)).toBe('carry-first'); // (4 + 2) × 3 = 18
    expect(diagnose(cell(p, 'r', 0), 2)).toBe('tens-digit'); // 7 × 3 = 21
  });
  it('a final carry becomes the leading digit', () => {
    const p = plan('mul', [56, 7]);
    expect(p.answer).toBe('392');
    expect(cell(p, 'r', 2)).toMatchObject({ want: 3, kind: 'd' });
  });
  it('long multiplication, UK: placeholder zero in the second row', () => {
    const p = plan('mul', [34, 26], { placeholder: 'zero' });
    expect(p.answer).toBe('884');
    expect(p.partials.map((x) => x.row)).toEqual(['p0', 'p1']);
    expect(read(p, 'p0')).toBe('204');
    expect(read(p, 'p1')).toBe('680');
    expect(cell(p, 'p1', 0)).toMatchObject({ kind: 'z', want: 0 });
    expect(diagnose(cell(p, 'p1', 0), 8)).toBe('placeholder');
    expect(read(p, 'r')).toBe('884');
  });
  it('long multiplication, Iran and Afghanistan: the second row is shifted, with no zero', () => {
    const p = plan('mul', [34, 26], { placeholder: 'shift' });
    expect(read(p, 'p1')).toBe('68');
    expect(cell(p, 'p1', 1)).toMatchObject({ want: 8 });
    expect(row(p, 'p1').some((c) => c.kind === 'z')).toBe(false);
    expect(read(p, 'r')).toBe('884');
    expect(cell(p, 'r', 0).expr).toBe('4'); // only one digit in the ones column
  });
  it('steps run row by row, then through the sum', () => {
    const p = plan('mul', [34, 26], { placeholder: 'zero' });
    const order = [...new Set(p.cells.map((c) => c.step))];
    expect(order).toEqual([...Array(p.steps).keys()]);
    const firstSum = Math.min(...row(p, 'r').map((c) => c.step));
    expect(Math.max(...row(p, 'p1').map((c) => c.step))).toBeLessThan(firstSum);
  });
  it('skips a 0 digit in the multiplier', () => {
    const p = plan('mul', [123, 102], { placeholder: 'zero' });
    expect(p.answer).toBe('12546');
    expect(p.partials.map((x) => x.j)).toEqual([0, 2]);
    expect(read(p, 'p1')).toBe('12300');
  });
  it('decimals: multiply as whole numbers and count the decimal places', () => {
    const p = plan('mul', ['1.25', '3']);
    expect(p.answer).toBe('3.75');
    expect(p.operands[0].mark).toBe(2);
    expect(plan('mul', ['0.4', '0.2']).answer).toBe('0.08');
  });
  it('refuses multiplying by 0', () => {
    expect(() => plan('mul', [5, 0])).toThrow();
  });
});

describe('every plan is self-consistent', () => {
  const cases: [Parameters<typeof plan>[0], (number | string)[]][] = [
    ['add', [999, 1]], ['add', [5, 5]], ['add', ['0.9', '0.15']], ['sub', [1000, 999]], ['sub', [900, 456]],
    ['sub', ['10', '0.01']], ['mul', [999, 99]], ['mul', [12, 10]], ['mul', ['2.5', '0.4']],
  ];
  for (const [op, t] of cases) {
    it(`${op} ${t.join(', ')}`, () => {
      const p = plan(op, t, { placeholder: 'zero' });
      const v = t.map(Number);
      const want = op === 'add' ? v.reduce((a, b) => a + b) : op === 'sub' ? v[0] - v[1] : v[0] * v[1];
      expect(Number(p.answer)).toBeCloseTo(want, 9);
      const digits = row(p, 'r').filter((c: Cell) => c.kind === 'd');
      expect(digits.every((c) => c.want >= 0 && c.want <= 9)).toBe(true);
      expect(p.cells.every((c) => c.step < p.steps)).toBe(true);
    });
  }
});

describe('inverse check («امتحان»)', () => {
  it('checks a subtraction by adding and an addition by subtracting', () => {
    expect(inverse('sub', [403, 168], '235')).toEqual({ op: 'add', terms: ['235', '168'] });
    expect(inverse('add', [58, 27], '85')).toEqual({ op: 'sub', terms: ['85', '27'] });
    expect(inverse('mul', [3, 4], '12')).toBeNull();
    expect(inverse('add', [1, 2, 3], '6')).toBeNull();
  });
});
