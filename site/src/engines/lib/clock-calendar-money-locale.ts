// Locale of <kg-clock-calendar-money>, from <html lang>. Kept apart so the engine shell stays tiny.
export type CalLocale = 'fa-IR' | 'fa-AF' | 'ps' | 'en';

export function calLocale(lang: string | null | undefined): CalLocale {
  const l = (lang ?? '').toLowerCase();
  if (l.startsWith('ps')) return 'ps';
  if (l === 'fa-af' || l === 'prs') return 'fa-AF';
  if (l.startsWith('fa')) return 'fa-IR';
  return 'en';
}
