// Server-side rendering of authored text: escapes HTML and expands placeholders (docs/STUDIOS.md).
import { LOCALES, type LocaleCode } from '../i18n/locales';
import { fracHTML, formatDecimal, type NumberFormat } from './display';
import { term } from './i18n';

export function numberFormat(locale: LocaleCode): NumberFormat {
  return { digits: LOCALES[locale].digits, decimal: LOCALES[locale].decimalMark };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Authored text may use these tags only (no attributes); everything else stays escaped. */
const allowTags = (s: string) => s.replace(/&lt;(\/?)(b|i|br)\s*\/?&gt;/g, '<$1$2>');

// A math operand: a placeholder fraction/mixed/number, or plain digits in any script (optionally with a decimal mark).
const OPERAND = String.raw`(?:\{\{(?:frac|mixed|num):[^}]+\}\}|[0-9۰-۹]+(?:[/.,٫][0-9۰-۹]+)?)`;
const OPERATOR = String.raw`[+\-−×÷=<>≤≥]`;
const EXPRESSION = new RegExp(`${OPERAND}(?:\\s*${OPERATOR}\\s*${OPERAND})+`, 'g');

/**
 * Formulas run left to right in every locale (docs/NOTATION.md), even inside RTL sentences,
 * so any "operand operator operand …" run is wrapped in Unicode directional isolates (LRI … PDI).
 */
function isolateFormulas(text: string): string {
  return text.replace(EXPRESSION, (m) => `\u2066${m}\u2069`);
}

export function rich(text: string, locale: LocaleCode): string {
  const f = numberFormat(locale);
  const source = locale === 'en' ? text : isolateFormulas(text.replace(/[\u2066-\u2069]/g, ''));
  return allowTags(escape(source)).replace(/\{\{(\w+):([^}]+)\}\}/g, (m, kind: string, arg: string) => {
    switch (kind) {
      case 'term':
        return term(arg.trim(), locale);
      case 'frac': {
        const [n, d] = arg.split('/').map((s) => s.trim());
        return fracHTML(n, d, f);
      }
      case 'mixed': {
        const [whole, fr] = arg.trim().split(/\s+/);
        const [n, d] = fr.split('/');
        return fracHTML(n, d, f, whole);
      }
      case 'num':
        return formatDecimal(arg.trim(), f);
      default:
        throw new Error(`Unknown placeholder ${m}`);
    }
  });
}
