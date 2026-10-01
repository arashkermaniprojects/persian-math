import type { LocaleCode } from '../i18n/locales';
import faIR from '../i18n/ui/fa-IR.json';
import faAF from '../i18n/ui/fa-AF.json';
import ps from '../i18n/ui/ps.json';
import en from '../i18n/ui/en.json';
import glossary from '../../../content/glossary.json';

type Dict = Record<string, string>;
const UI: Record<LocaleCode, Dict> = { 'fa-IR': faIR, 'fa-AF': faAF, ps, en };

interface Term { id: string; 'fa-IR': string; 'fa-AF'?: string; ps?: string; en: string }
const TERMS = new Map((glossary.terms as Term[]).map((t) => [t.id, t]));

/** Resolve a glossary term, falling back to Iranian Persian (for fa-AF and ps) or English. */
export function term(id: string, locale: LocaleCode): string {
  const t = TERMS.get(id);
  if (!t) throw new Error(`Unknown glossary term: ${id}`);
  return t[locale] || (locale === 'en' ? t.en : t['fa-IR']);
}

/** Translate a UI key; `{{term:id}}` placeholders are resolved through the glossary. */
export function t(key: string, locale: LocaleCode): string {
  const s = UI[locale][key] ?? UI['fa-IR'][key];
  if (s === undefined) throw new Error(`Missing UI string: ${key}`);
  return s.replace(/\{\{term:([\w.-]+)\}\}/g, (_m, id: string) => term(id, locale));
}
