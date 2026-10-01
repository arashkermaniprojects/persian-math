// Pure long-division algorithm: the steps a learner writes, digit by digit (docs/NOTATION.md §3).
// Used by <kg-long-division> and by the unit tests; no DOM here.

export interface LDStep {
  /** Index in `digits` (dividend digits, then appended decimal zeros) that this step's partial ends on. */
  pos: number;
  /** The number being divided in this step (previous remainder with the next digit brought down). */
  partial: number;
  /** Quotient digit written for this step. */
  q: number;
  /** q × divisor, written under the partial. */
  product: number;
  /** partial − product. */
  rem: number;
}

export interface LDPlan {
  dividend: number;
  divisor: number;
  /** Digits of the dividend followed by the zeros brought down after the decimal mark. */
  digits: number[];
  /** Number of digits of the whole-number dividend. Positions ≥ intLen are decimal places. */
  intLen: number;
  /** Decimal places actually used (≤ the requested maximum; fewer if the division ends early). */
  decimals: number;
  steps: LDStep[];
  /** The quotient in ASCII with "." as the decimal mark, e.g. "0.75". */
  quotient: string;
  /** Remainder after the last step. */
  remainder: number;
}

/**
 * Long division of whole numbers, continued to at most `maxDecimals` decimal places.
 * The first step uses the shortest leading part of the dividend that is at least the divisor
 * (or the whole dividend, with quotient digit 0, if it is smaller than the divisor).
 * Each later step brings down one digit; a step whose quotient digit is 0 has product 0.
 * Decimal places stop as soon as the remainder is 0.
 */
export function longDivision(dividend: number, divisor: number, maxDecimals = 0): LDPlan {
  if (!Number.isInteger(dividend) || dividend < 0) throw new Error(`longDivision: bad dividend ${dividend}`);
  if (!Number.isInteger(divisor) || divisor < 1) throw new Error(`longDivision: bad divisor ${divisor}`);
  const digits = String(dividend).split('').map(Number);
  const intLen = digits.length;

  let pos = 0;
  let cur = digits[0];
  while (cur < divisor && pos < intLen - 1) cur = cur * 10 + digits[++pos];

  const steps: LDStep[] = [];
  for (;;) {
    const q = Math.floor(cur / divisor);
    const product = q * divisor;
    const rem = cur - product;
    steps.push({ pos, partial: cur, q, product, rem });
    if (pos + 1 < intLen) {
      cur = rem * 10 + digits[++pos];
    } else if (rem !== 0 && digits.length - intLen < maxDecimals) {
      digits.push(0);
      cur = rem * 10;
      pos++;
    } else break;
  }

  const qs = (from: number, to: number) => steps.filter((s) => s.pos >= from && s.pos < to).map((s) => s.q).join('');
  const whole = qs(0, intLen) || '0';
  const frac = qs(intLen, Infinity);
  return {
    dividend,
    divisor,
    digits,
    intLen,
    decimals: digits.length - intLen,
    steps,
    quotient: frac ? `${whole}.${frac}` : whole,
    remainder: steps[steps.length - 1].rem,
  };
}
