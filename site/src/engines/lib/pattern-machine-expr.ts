// Arithmetic expressions for <kg-pattern-machine>: machine rules ("2*n+3" or stages), sequence rules and
// step-by-step order of operations. Pure, no DOM. Formulas always run left to right (docs/NOTATION.md).

export type Op = '+' | '−' | '×' | '÷' | '^';
export type Tok = { t: 'n'; v: number } | { t: 'o'; v: Op } | { t: '(' } | { t: ')' } | { t: 'x'; v: string };

const OPS: Record<string, Op> = { '+': '+', '-': '−', '−': '−', '*': '×', '×': '×', '/': '÷', '÷': '÷', ':': '÷', '^': '^' };
const PREC: Record<Op, number> = { '+': 1, '−': 1, '×': 2, '÷': 2, '^': 3 };
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Normalise an operator written as + - − * × / ÷ ^ (null if unknown). */
export const opOf = (s: string): Op | null => OPS[s] ?? null;

/**
 * Tokens of an expression such as "3 + 4 × (6 − 2)" or "2*n+3". Digits may be ASCII or Persian. A minus at the
 * start or after "(" or an operator is part of the number. Single letters are variables; 2n and 3(n + 1) mean ×.
 */
export function tokenize(src: string): Tok[] {
  const s = src.replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)));
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const prev = out[out.length - 1];
    const unary = (c === '-' || c === '−') && (!prev || prev.t === 'o' || prev.t === '(');
    if (/\s/.test(c)) i++;
    else if (/[0-9.]/.test(c) || (unary && /[0-9.]/.test(s[i + 1] ?? ''))) {
      const m = s.slice(i).match(/^[-−]?[0-9]*\.?[0-9]+/)!;
      out.push({ t: 'n', v: Number(m[0].replace('−', '-')) });
      i += m[0].length;
    } else if (c === ')') { out.push({ t: c }); i++; }
    else if (c === '(' || /[a-zA-Z]/.test(c)) {
      // 2n, 3(n + 1): a number or letter right before a letter or bracket means ×.
      if (prev && (prev.t === 'n' || prev.t === 'x' || prev.t === ')')) out.push({ t: 'o', v: '×' });
      out.push(c === '(' ? { t: c } : { t: 'x', v: c });
      i++;
    } else if (OPS[c]) { out.push({ t: 'o', v: OPS[c] }); i++; }
    else throw new Error(`Bad character "${c}" in expression ${src}`);
  }
  return out;
}

export function apply(op: Op, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return a / b;
    case '^': return a ** b;
  }
}

/** Value of a token list with the usual priority: brackets, powers, × ÷, then + − (each left to right; ^ right to left). */
export function evaluate(toks: Tok[], vars: Record<string, number> = {}): number {
  const nums: number[] = [], ops: (Op | '(')[] = [];
  const reduce = () => { const b = nums.pop()!, a = nums.pop()!; nums.push(apply(ops.pop() as Op, a, b)); };
  for (const k of toks) {
    if (k.t === 'n') nums.push(k.v);
    else if (k.t === 'x') {
      if (!(k.v in vars)) throw new Error(`No value for ${k.v}`);
      nums.push(vars[k.v]);
    } else if (k.t === '(') ops.push('(');
    else if (k.t === ')') { while (ops.length && ops[ops.length - 1] !== '(') reduce(); ops.pop(); }
    else {
      const p = PREC[k.v];
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top === '(' || PREC[top] < p || (PREC[top] === p && k.v === '^')) break;
        reduce();
      }
      ops.push(k.v);
    }
  }
  while (ops.length) reduce();
  if (nums.length !== 1 || Number.isNaN(nums[0])) throw new Error('Malformed expression');
  return nums[0];
}

/** A machine rule: an expression in one letter ("2*n+3") or stages run one after another ([["×", 2], ["+", 3]]). */
export type Rule = string | [string, number][];

/** The letter a rule expression uses (default n). */
export const letterOf = (rule: string) => tokenize(rule).find((k) => k.t === 'x')?.v ?? 'n';

export function runRule(rule: Rule, x: number): number {
  if (typeof rule === 'string') return round(evaluate(tokenize(rule), { [letterOf(rule)]: x }));
  return round(rule.reduce((v, [op, n]) => apply(opOf(op)!, v, n), x));
}

/** Kill floating-point dust (0.1 + 0.2) so answers compare exactly. */
export const round = (v: number) => Math.round(v * 1e9) / 1e9;

/** Inverse of a rule, when it is made of stages (for "what went in?"): undo the stages in reverse order. */
export function undoRule(rule: Rule, y: number): number | null {
  if (typeof rule === 'string') return null;
  const inv: Record<Op, Op> = { '+': '−', '−': '+', '×': '÷', '÷': '×', '^': '^' };
  let v = y;
  for (const [op, n] of [...rule].reverse()) {
    const o = opOf(op)!;
    v = o === '^' ? v ** (1 / n) : apply(inv[o], v, n);
  }
  return round(v);
}

/** Index (in toks) of each innermost bracket group's start, and the group of every token. */
function groups(toks: Tok[]) {
  const g: number[] = [];
  const stack: number[] = [-1];
  toks.forEach((k, i) => {
    if (k.t === '(') { g.push(stack[stack.length - 1]); stack.push(i); }
    else if (k.t === ')') { stack.pop(); g.push(stack[stack.length - 1]); }
    else g.push(stack[stack.length - 1]);
  });
  return g;
}

/** Operators that may be done now: both neighbours are numbers, in a bracket with no brackets inside it. */
export function ready(toks: Tok[]): number[] {
  return toks.map((k, i) => (k.t === 'o' && toks[i - 1]?.t === 'n' && toks[i + 1]?.t === 'n' ? i : -1)).filter((i) => i >= 0);
}

/**
 * Operators the rules say to do next: inside an innermost bracket, powers first (rightmost), then × ÷, then + −,
 * each from left to right. With two separate brackets, either is right.
 */
export function rightNext(toks: Tok[]): number[] {
  const g = groups(toks);
  const hasInner = new Set(toks.map((k, i) => (k.t === '(' ? g[i] : null)).filter((x) => x !== null));
  const byGroup = new Map<number, number[]>();
  toks.forEach((k, i) => {
    if (k.t !== 'o' || hasInner.has(g[i])) return;
    byGroup.set(g[i], [...(byGroup.get(g[i]) ?? []), i]);
  });
  const out: number[] = [];
  for (const ops of byGroup.values()) {
    const top = Math.max(...ops.map((i) => PREC[(toks[i] as { v: Op }).v]));
    const best = ops.filter((i) => PREC[(toks[i] as { v: Op }).v] === top);
    out.push(top === 3 ? best[best.length - 1] : best[0]);
  }
  return out.filter((i) => ready(toks).includes(i));
}

/** Do the operator at index i; brackets left around a single number disappear. */
export function applyAt(toks: Tok[], i: number): Tok[] {
  const a = toks[i - 1], o = toks[i], b = toks[i + 1];
  if (a?.t !== 'n' || o?.t !== 'o' || b?.t !== 'n') return toks;
  const out: Tok[] = [...toks.slice(0, i - 1), { t: 'n', v: round(apply(o.v, a.v, b.v)) }, ...toks.slice(i + 2)];
  for (let j = 1; j < out.length - 1; j++)
    if (out[j - 1].t === '(' && out[j].t === 'n' && out[j + 1].t === ')') { out.splice(j + 1, 1); out.splice(j - 1, 1); j = 0; }
  return out;
}

/** Plain text of tokens with ASCII digits (the engine maps digits to the locale). */
export function show(toks: Tok[]): string {
  return toks.map((k) => (k.t === 'n' ? String(k.v) : k.t === 'o' ? k.v : k.t === 'x' ? k.v : k.t)).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
}

/** "+5", "×2" for a stage; a string rule is shown as written. */
export function showRule(rule: Rule): string {
  return typeof rule === 'string' ? show(tokenize(rule)) : rule.map(([op, n]) => `${opOf(op)}${n}`).join(' ');
}
