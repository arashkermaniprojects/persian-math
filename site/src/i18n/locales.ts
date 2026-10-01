// Locale registry. Everything locale-specific that is not a translated string lives here.
// Notation follows docs/NOTATION.md (verified against the Iranian and Afghan textbooks).
// Owner decision (2026-10-02): Persian digits ۱۲۳ in all three RTL locales at every grade, with no Latin-digit option,
// even though Afghan books switch to Latin digits from grade 7.

export type LocaleCode = 'fa-IR' | 'fa-AF' | 'ps' | 'en';

/** `draft` locales are built only into the reviewer preview, never shown to children. */
export type ReleaseStatus = 'reviewed' | 'draft';

export interface LocaleMeta {
  code: LocaleCode;
  /** BCP-47 tag for the <html lang> attribute */
  htmlLang: string;
  dir: 'rtl' | 'ltr';
  /** Native name, shown in the language switcher */
  nativeName: string;
  /** Digits 0–9 in this locale */
  digits: string;
  decimalMark: string;
  /** Default curriculum path suggested for this locale */
  defaultPath: 'iran' | 'afghanistan' | 'uk';
  status: ReleaseStatus;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const LOCALES: Record<LocaleCode, LocaleMeta> = {
  'fa-IR': {
    code: 'fa-IR', htmlLang: 'fa-IR', dir: 'rtl', nativeName: 'فارسی',
    digits: PERSIAN_DIGITS, decimalMark: '/', defaultPath: 'iran', status: 'reviewed',
  },
  'fa-AF': {
    code: 'fa-AF', htmlLang: 'fa-AF', dir: 'rtl', nativeName: 'دری',
    digits: PERSIAN_DIGITS, decimalMark: ',', defaultPath: 'afghanistan', status: 'draft', // «ممیزه»
  },
  ps: {
    code: 'ps', htmlLang: 'ps-AF', dir: 'rtl', nativeName: 'پښتو',
    digits: PERSIAN_DIGITS, decimalMark: ',', defaultPath: 'afghanistan', status: 'draft',
  },
  en: {
    code: 'en', htmlLang: 'en', dir: 'ltr', nativeName: 'English',
    digits: '0123456789', decimalMark: '.', defaultPath: 'uk', status: 'reviewed',
  },
};

export const DEFAULT_LOCALE: LocaleCode = 'fa-IR';
export const LOCALE_CODES = Object.keys(LOCALES) as LocaleCode[];

/** Locales visible to learners in this build. PREVIEW=1 also includes drafts (for reviewers). */
export function visibleLocales(): LocaleCode[] {
  const preview = import.meta.env.PUBLIC_PREVIEW === '1';
  return LOCALE_CODES.filter((c) => preview || LOCALES[c].status === 'reviewed');
}
