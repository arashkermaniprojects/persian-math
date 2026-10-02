// Server-side rendering of authored text: escapes HTML and expands placeholders (docs/STUDIOS.md).
import { LOCALES, type LocaleCode } from '../i18n/locales';
import { algHTML, fracHTML, formatDecimal, vecHTML, type NumberFormat } from './display';
import { term } from './i18n';

export function numberFormat(locale: LocaleCode): NumberFormat {
  return { digits: LOCALES[locale].digits, decimal: LOCALES[locale].decimalMark };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Authored text may use these tags only (no attributes); everything else stays escaped. */
const allowTags = (s: string) => s.replace(/&lt;(\/?)(b|i|br)\s*\/?&gt;/g, '<$1$2>');

// A math operand: a placeholder fraction/mixed/number, or plain digits in any script (optionally with a decimal mark),
// optionally followed by a percent sign (۲۵٪ = {{frac:1/4}}).
const OPERAND = String.raw`(?:\{\{(?:frac|mixed|num):[^}]+\}\}|[0-9۰-۹]+(?:[/.,٫][0-9۰-۹]+)?)[٪%]?`;
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
      case 'alg':
        // an algebra expression, left to right with locale digits: {{alg:3x^2 - 2x + 1}} (isolates added above are dropped)
        return algHTML(arg.replace(/[⁦-⁩]/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim(), f.digits);
      case 'vec': {
        // a coordinate pair / vector: a column in fa-IR (as in Iran's books), (x, y) elsewhere
        const [x, y] = arg.split(',');
        return vecHTML(x, y, f, locale === 'fa-IR');
      }
      default:
        throw new Error(`Unknown placeholder ${m}`);
    }
  });
}
