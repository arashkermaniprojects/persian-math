// Pure logic for <kg-column-arithmetic>: written column addition, subtraction (with borrowing) and multiplication,
// planned as the cells a learner fills in, one column (a "step") at a time. No DOM here.
//
// Columns are numbered from the right: col 0 is the rightmost column of the sheet.
//  - add/sub: numbers line up on the decimal mark; D = the most decimal places, so the ones column is col D.
//    Shorter decimals are padded with zeros (shown muted), as the books do.
//  - mul: numbers are right-aligned whatever their decimal places (the mark is placed in the answer by counting).

export type Op = 'add' | 'sub' | 'mul';
/** Reason codes for a wrong digit (or a refused borrow tap); the engine maps them to label-err-* text. */
export type Code =
  | 'forgot-carry' // added/multiplied the column but left out the carried digit
  | 'tens-digit' // wrote the tens of the column total instead of its ones
  | 'carry-first' // multiplication: added the carry before multiplying
  | 'placeholder' // long multiplication (UK): the placeholder must be 0
  | 'smaller-from-larger' // subtraction: took the top digit from the bottom one instead of borrowing
  | 'mark-borrow' // right digit, but the borrow was not written: tap the digit on the left first
  | 'old-digit' // used the digit before it lent one
  | 'no-borrow' // tapped to borrow where no borrow is needed
  | 'borrow-zero' // tapped a 0 to borrow from: it has nothing to lend yet
  | 'too-far' // tapped further left than the nearest digit that can lend
  | 'wrong';

export interface Num {
  /** Digits, least significant first, without the decimal mark. */
  ds: number[];
  /** Decimal places. */
  scale: number;
}

export interface Operand {
  /** Digit in each column (index = col), or null where the number has no digit. */
  ds: (number | null)[];
  /** True for padded zeros (after the last decimal digit). */
  pad: boolean[];
  /** The decimal mark sits at the right edge of this column; -1 for none. */
  mark: number;
}

/** A box the learner fills. `row`: 'r' result, 'c' carries into the result, 'p<k>' partial product k, 'pc<k>' its carries. */
export interface Cell {
  row: string;
  col: number;
  want: number;
  step: number;
  kind: 'd' | 'c' | 'z';
  /** Known wrong digits and their codes, most likely first. */
  alts?: [number, Code][];
  /** ASCII question for a digit, e.g. "8 + 7 + 1" or "3 × 4 + 2" (sub questions are built live from the borrows). */
  expr?: string;
  /** For a carry cell: the column total it comes from. */
  s?: number;
}

export interface Plan {
  op: Op;
  operands: Operand[];
  /** Number of digit columns. */
  width: number;
  /** Decimal places of the answer. */
  scale: number;
  /** Ones column (add/sub: D; mul: 0). */
  ones: number;
  cells: Cell[];
  steps: number;
  /** Partial products of long multiplication: their row name, multiplier digit and its column. Empty otherwise. */
  partials: { row: string; m: number; j: number }[];
  /** Subtraction only: the top and bottom digit of every column (padded zeros count as 0). */
  top?: number[];
  bottom?: number[];
  /** The answer, ASCII with "." as the mark, e.g. "16.25". */
  answer: string;
}

export interface PlanOptions {
  /** Long multiplication: 'zero' writes placeholder zeros the learner types (UK); 'shift' leaves the cells empty (Iran, Afghanistan). */
  placeholder?: 'zero' | 'shift';
}

export function parseNum(x: number | string): Num {
  const s = String(x).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad number ${x}`);
  const [i, f = ''] = s.split('.');
  const int = i.replace(/^0+(?=\d)/, '');
  return { ds: [...(int + f)].reverse().map(Number), scale: f.length };
}

/** Value comparison of two numbers given as digit arrays at the same scale (LSB first). */
function cmpDigits(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = n - 1; i >= 0; i--) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function toText(ds: number[], scale: number): string {
  const s = ds.slice().reverse().join('').padStart(scale + 1, '0');
  const int = s.slice(0, s.length - scale).replace(/^0+(?=\d)/, '');
  return scale ? `${int}.${s.slice(s.length - scale)}` : int;
}

/** Add columns of digits (LSB first) with carries; returns the result digits. */
function addCols(rows: (number | null)[][], width: number, cells: Cell[], step: number, rRow: string, cRow: string) {
  const out: number[] = [];
  let cin = 0;
  for (let c = 0; c < width || cin; c++) {
    const col = rows.map((r) => r[c]).filter((d): d is number => d != null);
    if (c >= width && !col.length) {
      // Only the carry is left: it is written straight into the answer.
      cells.push({ row: rRow, col: c, want: cin, step: step++, kind: 'd' });
      out[c] = cin;
      cin = 0;
      break;
    }
    const s0 = col.reduce((a, b) => a + b, 0);
    const s = s0 + cin;
    const want = s % 10;
    const cout = Math.floor(s / 10);
    const alts: [number, Code][] = [];
    if (cin && s0 % 10 !== want) alts.push([s0 % 10, 'forgot-carry']);
    if (cout && cout !== want) alts.push([cout, 'tens-digit']);
    const parts = col.map(String);
    if (cin) parts.push(String(cin));
    cells.push({ row: rRow, col: c, want, step, kind: 'd', alts, expr: parts.join(' + ') });
    const more = c + 1 < width || rows.some((r) => r[c + 1] != null);
    if (cout && more) cells.push({ row: cRow, col: c + 1, want: cout, step, kind: 'c', s });
    out[c] = want;
    step++;
    cin = cout;
  }
  return { out, step, width: Math.max(width, out.length) };
}

export function plan(op: Op, terms: (number | string)[], opts: PlanOptions = {}): Plan {
  const nums = terms.map(parseNum);
  if (nums.length < 2 || (op !== 'add' && nums.length !== 2)) throw new Error(`${op}: wrong number of terms`);
  return op === 'mul' ? planMul(nums, opts) : planAddSub(op, nums);
}

function planAddSub(op: Op, nums: Num[]): Plan {
  const D = Math.max(...nums.map((n) => n.scale));
  const operands: Operand[] = nums.map((n) => {
    const sh = D - n.scale;
    const ds: (number | null)[] = [];
    const pad: boolean[] = [];
    for (let c = 0; c < sh; c++) { ds[c] = 0; pad[c] = true; }
    n.ds.forEach((d, i) => { ds[i + sh] = d; pad[i + sh] = false; });
    return { ds, pad, mark: D ? D : -1 };
  });
  const width = Math.max(...operands.map((o) => o.ds.length));
  const cells: Cell[] = [];

  if (op === 'add') {
    const r = addCols(operands.map((o) => o.ds), width, cells, 0, 'r', 'c');
    return { op, operands, width: r.width, scale: D, ones: D, cells, steps: r.step, partials: [], answer: toText(r.out, D) };
  }

  const top = operands[0].ds.map((d) => d ?? 0);
  const bottom = Array.from({ length: width }, (_, c) => operands[1].ds[c] ?? 0);
  if (cmpDigits(top, bottom) < 0) throw new Error('sub: negative answer');
  while (top.length < width) top.push(0);
  const vals = top.slice();
  const res: number[] = [];
  for (let c = 0; c < width; c++) {
    for (let j: number; (j = borrowFrom(vals, bottom, c)) >= 0; ) tapBorrow(vals, bottom, c, j);
    res[c] = vals[c] - bottom[c];
  }
  let hi = width - 1;
  while (hi > D && res[hi] === 0) hi--;
  for (let c = 0; c <= hi; c++) cells.push({ row: 'r', col: c, want: res[c], step: c, kind: 'd' });
  return { op, operands, width, scale: D, ones: D, cells, steps: hi + 1, partials: [], top, bottom, answer: toText(res.slice(0, hi + 1), D) };
}

function planMul([a, b]: Num[], opts: PlanOptions): Plan {
  const operands: Operand[] = [a, b].map((n) => ({ ds: n.ds.slice(), pad: n.ds.map(() => false), mark: n.scale ? n.scale : -1 }));
  const cells: Cell[] = [];
  const partials: Plan['partials'] = [];
  const rows: (number | null)[][] = [];
  const nz = b.ds.map((m, j) => ({ m, j })).filter((x) => x.m);
  if (!nz.length || a.ds.every((d) => !d)) throw new Error('mul: by 0');
  const single = nz.length === 1;
  let step = 0;
  nz.forEach(({ m, j }, k) => {
    const row = single ? 'r' : `p${k}`;
    const cRow = single ? 'c' : `pc${k}`;
    partials.push({ row, m, j });
    const vals: (number | null)[] = [];
    if (j && opts.placeholder === 'zero') {
      for (let c = 0; c < j; c++) {
        cells.push({ row, col: c, want: 0, step, kind: 'z', alts: [] });
        vals[c] = 0;
      }
      step++;
    }
    let cin = 0;
    a.ds.forEach((x, i) => {
      const s = x * m + cin;
      const want = s % 10;
      const cout = Math.floor(s / 10);
      const alts: [number, Code][] = [];
      const add = (v: number, code: Code) => { if (v !== want && !alts.some((t) => t[0] === v)) alts.push([v, code]); };
      if (cin) add((x * m) % 10, 'forgot-carry');
      if (cin) add(((x + cin) * m) % 10, 'carry-first');
      if (cout) add(cout % 10, 'tens-digit');
      cells.push({ row, col: i + j, want, step, kind: 'd', alts, expr: `${x} × ${m}` + (cin ? ` + ${cin}` : '') });
      if (cout && i + 1 < a.ds.length) cells.push({ row: cRow, col: i + j + 1, want: cout, step, kind: 'c', s });
      vals[i + j] = want;
      step++;
      cin = cout;
    });
    if (cin) {
      cells.push({ row, col: a.ds.length + j, want: cin, step: step++, kind: 'd' });
      vals[a.ds.length + j] = cin;
    }
    rows.push(vals);
  });
  const scale = a.scale + b.scale;
  let out = rows[0].map((d) => d ?? 0);
  let width = Math.max(a.ds.length, b.ds.length, out.length);
  if (!single) {
    // Partial rows written with 'shift' have empty cells on the right; they count as 0 in the sum.
    const r = addCols(rows, Math.max(...rows.map((x) => x.length)), cells, step, 'r', 'c');
    step = r.step;
    out = r.out;
    width = Math.max(width, r.width);
  }
  return { op: 'mul', operands, width, scale, ones: 0, cells, steps: step, partials, answer: toText(out, scale) };
}

/**
 * The column the learner should tap next to borrow for column c, or -1 if none is needed: the nearest column on the
 * left that is not 0. Borrows ripple through zeros: 403 − 168 → 3|10|3 → 13|9|3.
 */
export function borrowFrom(vals: number[], bottom: number[], c: number): number {
  if (vals[c] >= bottom[c]) return -1;
  let j = c + 1;
  while (j < vals.length && vals[j] === 0) j++;
  return j < vals.length ? j : -1;
}

/**
 * The learner taps top digit j to borrow while working on column c. On success returns null and changes vals
 * (vals[j] − 1, vals[j − 1] + 10). Otherwise returns why the tap is refused, and vals is unchanged.
 */
export function tapBorrow(vals: number[], bottom: number[], c: number, j: number): Code | null {
  const want = borrowFrom(vals, bottom, c);
  if (want < 0 || j <= c) return 'no-borrow';
  if (j === want) {
    vals[j]--;
    vals[j - 1] += 10;
    return null;
  }
  return j < want ? 'borrow-zero' : 'too-far';
}

/** Check a digit typed in column c of a subtraction, given the (possibly borrowed) top digits. */
export function subDigit(vals: number[], top: number[], bottom: number[], c: number, typed: number): { ok: boolean; code?: Code } {
  const v = vals[c];
  const b = bottom[c];
  if (v < b) {
    if (typed === b - v) return { ok: false, code: 'smaller-from-larger' };
    if (typed === v + 10 - b) return { ok: false, code: 'mark-borrow' };
    return { ok: false, code: 'wrong' };
  }
  if (typed === v - b) return { ok: true };
  if (v < top[c] && top[c] >= b && typed === top[c] - b) return { ok: false, code: 'old-digit' };
  return { ok: false, code: 'wrong' };
}

/** Which known mistake (if any) a wrong digit matches. */
export function diagnose(cell: Cell, typed: number): Code {
  if (cell.kind === 'z') return 'placeholder';
  return cell.alts?.find((a) => a[0] === typed)?.[1] ?? 'wrong';
}

/** The inverse operation used to check an answer (Afghan «امتحان»): a − b = d is checked by d + b; a + b = s by s − b. */
export function inverse(op: Op, terms: (number | string)[], answer: string): { op: Op; terms: string[] } | null {
  if (terms.length !== 2) return null;
  if (op === 'sub') return { op: 'add', terms: [answer, String(terms[1])] };
  if (op === 'add') return { op: 'sub', terms: [answer, String(terms[1])] };
  return null;
}
