import { LOCALES, type LocaleCode } from '../i18n/locales';

/** Replace ASCII digits 0–9 with the locale's digits. Leaves everything else untouched. */
export function localizeDigits(text: string, locale: LocaleCode): string {
  const digits = LOCALES[locale].digits;
  return text.replace(/[0-9]/g, (d) => digits[Number(d)]);
}
