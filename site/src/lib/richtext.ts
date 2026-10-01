// Server-side rendering of authored text: escapes HTML and expands placeholders (docs/STUDIOS.md).
import { LOCALES, type LocaleCode } from '../i18n/locales';
import { fracHTML, formatDecimal, type NumberFormat } from './display';
import { term } from './i18n';

export function numberFormat(locale: LocaleCode): NumberFormat {
  return { digits: LOCALES[locale].digits, decimal: LOCALES[locale].decimalMark };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function rich(text: string, locale: LocaleCode): string {
  const f = numberFormat(locale);
  return escape(text).replace(/\{\{(\w+):([^}]+)\}\}/g, (m, kind: string, arg: string) => {
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
