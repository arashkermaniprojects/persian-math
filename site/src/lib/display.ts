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
export function vecHTML(x: number | string, y: number | string, f: NumberFormat, column: boolean): string {
  const [a, b] = [x, y].map((v) => formatDecimal(String(v).trim().replace(/^−/, '-'), f));
  const label = `(${String(x).trim()}, ${String(y).trim()})`;
  if (column) return `<span class="vec" role="math" aria-label="${label}"><span>${a}</span><span>${b}</span></span>`;
  return `<bdi dir="ltr" class="pair">(${a}, ${b})</bdi>`;
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
