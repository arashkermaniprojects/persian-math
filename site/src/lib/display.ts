// Number and fraction display. Pure (no imports of content), so engines can use it in the browser.

export interface NumberFormat {
  digits: string; // the locale's 0–9
  decimal: string; // decimal mark
}

export function digitsOf(text: string | number, f: NumberFormat): string {
  return String(text).replace(/[0-9]/g, (d) => f.digits[Number(d)]);
}

export function formatDecimal(value: number | string, f: NumberFormat): string {
  const s = String(value);
  const neg = s.startsWith('-');
  const body = (neg ? s.slice(1) : s).replace('.', f.decimal);
  // The minus sign is isolated LTR so it stays on the left in RTL text, as in both countries' books.
  return neg ? `<bdi dir="ltr">-${digitsOf(body, f)}</bdi>` : digitsOf(body, f);
}

/**
 * A coordinate pair or vector. Iran's books write it as a column in square brackets, x on top (G6 «محورهای مختصات»,
 * G7 «بردار انتقال»); Afghan (G8) and UK books write (x, y). Always left to right.
 */
export function vecHTML(x: number | string, y: number | string, f: NumberFormat, column: boolean | 'round'): string {
  const [a, b] = [x, y].map((v) => formatDecimal(String(v).trim().replace(/^−/, '-'), f));
  const label = `(${String(x).trim()}, ${String(y).trim()})`;
  if (column) return `<span class="vec${column === 'round' ? ' round' : ''}" role="math" aria-label="${label}"><span>${a}</span><span>${b}</span></span>`;
  return `<bdi dir="ltr" class="pair">(${a}, ${b})</bdi>`;
}

/**
 * An algebra expression typed in ASCII ("3x^2 - 2x", "x = -3", "(-3)^2") as HTML, always left to right (docs/NOTATION.md):
 * locale digits, − for -, × for *, powers raised; letters stay Latin in every locale. Binary + − = ≠ get spaces; a sign
 * at the start or after "(" stays close: −۵, (−۳)². "a/b" is stacked, never inline ("/" is Iran's decimal mark): each
 * side is a bracket (dropped) or a run of letters and digits: x/3, (v - u)/a. Powers: a^2, a^-3, a^n, and a bracketed
 * index a^(1/2), a^(m + n) (the bracket is dropped; a fraction in it is stacked small).
 */
export function algHTML(src: string, digits = '0123456789'): string {
  return `<bdi dir="ltr" class="alg">${algInner(src, digits)}</bdi>`;
}

const ALG_FRAC = /(\([^()]*\)|[\w√.^]+)\/(\([^()]*\)|[\w√.^]+)/g;
const unbracket = (s: string) => s.replace(/^\((.*)\)$/, '$1');

function algInner(src: string, digits: string): string {
  const fr: string[] = [];
  // a bracketed index first, so a fraction inside it stays inside it: 9^(1/2)
  src = src.replace(/\^\(([^()]*)\)/g, (_, e: string) => {
    fr.push(`<sup>${algInner(e, digits)}</sup>`);
    return `\u0001${fr.length - 1}\u0002`;
  });
  src = src.replace(ALG_FRAC, (_, n: string, d: string) => {
    fr.push(`<span class="frac"><span class="frac-n">${algInner(unbracket(n), digits)}</span><span class="frac-d">${algInner(unbracket(d), digits)}</span></span>`);
    return `\u0001${fr.length - 1}\u0002`;
  });
  let out = '', prev = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === ' ' || /[⁦-⁩]/.test(ch)) continue;
    if (ch === '\u0001') {
      const end = src.indexOf('\u0002', i);
      out += fr[Number(src.slice(i + 1, end))];
      i = end;
      prev = 'x';
      continue;
    }
    const pow = ch === '^' && src.slice(i + 1).match(/^-?\d+|^[a-z]/);
    if (pow) {
      out += `<sup>${digitsOf(pow[0].replace('-', '−'), { digits, decimal: '.' })}</sup>`;
      i += pow[0].length;
      prev = '0';
      continue;
    }
    if (/[-−+=<>≤≥≠]/.test(ch)) {
      const sym = ch === '-' ? '−' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;
      out += prev && !/[-−+=<>≤≥≠(×]/.test(prev) ? ` ${sym} ` : sym;
    } else if (ch === '*' || ch === '×') out += '×';
    else if (ch === '&') out += '&amp;';
    else out += /[0-9]/.test(ch) ? digits[Number(ch)] : ch;
    prev = ch === '*' ? '×' : ch;
  }
  return out;
}

/**
 * Stacked fraction as HTML. Fractions are never written inline with "/" because
 * "/" is the decimal mark in Iranian books (docs/NOTATION.md).
 */
export function fracHTML(n: number | string, d: number | string, f: NumberFormat, whole?: number | string): string {
  const stack =
    `<span class="frac" role="math" aria-label="${n}/${d}">` +
    `<span class="frac-n">${digitsOf(n, f)}</span><span class="frac-d">${digitsOf(d, f)}</span></span>`;
  if (whole === undefined) return stack;
  // Mixed number: whole part on the left in every locale (both countries' books do this), isolated LTR.
  return `<bdi dir="ltr" class="mixed"><span class="mixed-whole">${digitsOf(whole, f)}</span>${stack}</bdi>`;
}

/**
 * Elements in set braces are separated by ", " (Iran G9, Afghan G7). Where "," is the decimal mark (fa-AF, ps) the
 * Arabic comma "، " is used instead, so {۲، ۵} cannot be read as the decimal ۲,۵.
 */
export const setSep = (f: NumberFormat) => (f.decimal === ',' ? '، ' : ', ');

/**
 * Set notation, always left to right (A = {۲, ۴, ۶}, A ∪ B, ۴ ∈ A), with locale digits. Authored text writes the
 * braces as [ ] because a placeholder cannot hold "}": {{set:A = [2, 4, 6]}}.
 */
export function setHTML(text: string, f: NumberFormat): string {
  // (formula isolates added around "7 + 5 = 12" are dropped: the whole notation is one isolate)
  const t = text.trim().replace(/[\u2066-\u2069]/g, '').replace(/\[/g, '{').replace(/\]/g, '}').replace(/\s*[,،]\s*/g, setSep(f));
  return `<bdi dir="ltr" class="set">${digitsOf(t, f)}</bdi>`;
}

/**
 * Interval notation, always left to right as in Afghan G9 «انتروال» and Iran G10 «بازه»: [−۲, ۴), (−∞, ۱], unions with ∪.
 * Authored as {{interval:[-2, 4)}}, {{interval:(-inf, 1] U (3, inf)}}. The ends are separated as set elements are.
 */
export function intervalHTML(text: string, f: NumberFormat): string {
  const t = text.trim().replace(/[⁦-⁩]/g, '').replace(/\binf\b|∞/g, '∞').replace(/\s*\bU\b\s*|\s*∪\s*/g, ' ∪ ')
    .replace(/-/g, '−').replace(/(\d)\.(\d)/g, `$1${f.decimal}$2`).replace(/\s*[,،]\s*/g, setSep(f));
  return `<bdi dir="ltr" class="set">${digitsOf(t, f)}</bdi>`;
}
