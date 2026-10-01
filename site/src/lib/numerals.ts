import { LOCALES, type LocaleCode } from '../i18n/locales';

/** Replace ASCII digits 0–9 with the locale's digits. Leaves everything else untouched. */
export function localizeDigits(text: string, locale: LocaleCode): string {
  const digits = LOCALES[locale].digits;
  return text.replace(/[0-9]/g, (d) => digits[Number(d)]);
}

/** Format a number for display: locale digits and decimal mark. No thousands grouping (school books don't use it consistently). */
export function formatNumber(n: number, locale: LocaleCode): string {
  const { decimalMark } = LOCALES[locale];
  const sign = n < 0 ? '-' : '';
  const [int, frac] = Math.abs(n).toString().split('.');
  const body = frac ? `${int}${decimalMark}${frac}` : int;
  return localizeDigits(sign + body, locale);
}
