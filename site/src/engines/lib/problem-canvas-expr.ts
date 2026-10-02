// Tiny arithmetic for <kg-problem-canvas>: reads typed numbers in any digit script, and evaluates the
// expressions that studios write for computed table columns, guess-and-check rules and number sentences.
// No eval(): a small recursive-descent parser over + − × ÷ ( ) and named variables.

/** "۱۲" / "١٢" / "12", with the locale decimal mark ("/" fa-IR, "," fa-AF/ps, "." en); null if not a number. */
export function parseNum(text: string, mark = '.'): number | null {
  let s = text.trim().replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660));
  s = s.replace(/[٬\s]/g, '').replace(/[−–]/g, '-');
  if (mark !== '.') s = s.split(mark).join('.');
  s = s.replace('٫', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

type Vars = Record<string, number | null | undefined>;

/** Round away floating-point noise (0.1 + 0.2), so results compare exactly with authored values. */
export const tidy = (n: number) => Math.round(n * 1e9) / 1e9;

/**
 * Value of an expression such as "4*x + 2*(10-x)", "a × b", "24 ÷ 3", or null when it cannot be worked out
 * (a syntax error, an unknown or empty variable, division by zero).
 */
export function evaluate(expr: string, vars: Vars = {}): number | null {
  const toks = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/\d+\.?\d*|[A-Za-z_]\w*|[-+*/()]|\S/g) ?? [];
  let i = 0;
  const fail = (): never => { throw 0; };
  const atom = (): number => {
    const t = toks[i++];
    if (t === undefined) return fail();
    if (t === '-') return -atom();
    if (t === '(') {
      const v = sum();
      if (toks[i++] !== ')') fail();
      return v;
    }
    if (/^\d/.test(t)) return Number(t);
    if (/^[A-Za-z_]/.test(t)) {
      const v = vars[t];
      return typeof v === 'number' ? v : fail();
    }
    return fail();
  };
  const product = (): number => {
    let v = atom();
    while (toks[i] === '*' || toks[i] === '/') {
      const op = toks[i++], r = atom();
      if (op === '/' && r === 0) fail();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (toks[i] === '+' || toks[i] === '-') v = toks[i++] === '+' ? v + product() : v - product();
    return v;
  };
  try {
    const v = sum();
    return i === toks.length && Number.isFinite(v) ? tidy(v) : null;
  } catch {
    return null;
  }
}
