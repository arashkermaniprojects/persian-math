import katex from 'katex';
import { LOCALES, type LocaleCode } from '../i18n/locales';
import { localizeDigits } from './numerals';

/**
 * Render a TeX formula to HTML for a locale.
 * Formulas are always laid out left-to-right (x, y stay Latin in every curriculum);
 * only the digits inside the rendered text nodes are localised.
 * The decimal point in TeX source should be written as `{.}` — it is swapped for the locale's decimal mark.
 */
export function renderMath(tex: string, locale: LocaleCode, displayMode = false): string {
  const html = katex.renderToString(tex, { displayMode, throwOnError: true, output: 'html' });
  const { decimalMark } = LOCALES[locale];
  // Only touch text between tags, never attribute values (KaTeX uses numbers in style="…").
  const localized = html.replace(/>([^<]+)</g, (_m, text: string) => {
    const withMark = decimalMark === '.' ? text : text.replace(/(?<=\d)\.(?=\d)/g, decimalMark);
    return `>${localizeDigits(withMark, locale)}<`;
  });
  return `<bdi dir="ltr" class="math">${localized}</bdi>`;
}
