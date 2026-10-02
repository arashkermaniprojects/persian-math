// DOM helpers shared by the three views of <kg-clock-calendar-money> (clock.ts, calendar.ts, money.ts).
// The views live in this folder, not in engines/, so the engine registry does not mistake them for engines,
// and each page loads only the view its missions use.
import type { CalLocale } from '../lib/clock-calendar-money-locale';

/** What a view needs from the element: locale, digits, labels, direction and the change event. */
export interface Host {
  dataset: DOMStringMap;
  loc: CalLocale;
  /** Locale digits. */
  d(n: number | string): string;
  /** Label from the studio's "engine" text, with {placeholders} (numbers get locale digits). */
  lbl(key: string, fallback: string, vars?: Record<string, string | number>): string;
  rtl(): boolean;
  changed(): void;
}

export interface View {
  root: HTMLElement;
  state(): object;
  /** Which instruction hint fits (drag, tap, set), if any. */
  tip?: string;
}

export const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export const btn = (cls: string, text: string, label?: string) => {
  const b = h('button', cls, text);
  b.type = 'button';
  if (label) b.setAttribute('aria-label', label);
  return b;
};

/** "label-x" style key with a suffix: key('caption', 'start') → "captionStart" (dataset form of caption-start). */
export const key = (prefix: string, name: string) => prefix + name[0].toUpperCase() + name.slice(1);

const ICON: Record<string, string> = {
  sun: '<circle r="5"/><path d="M0-9v-3M0 9v3M-9 0h-3M9 0h3M6.4-6.4l2-2M-6.4 6.4l-2 2M6.4 6.4l2 2M-6.4-6.4l-2-2"/>',
  moon: '<path d="M3-9a9 9 0 1 0 6 12A7 7 0 0 1 3-9z"/>',
  hand: '<path d="M-2 9v-12a2 2 0 0 1 4 0v7l5 1a2 2 0 0 1 2 2l-1 6h-9z"/><path d="M-6-8a7 7 0 0 1 12 0" fill="none"/>',
};
export const icon = (name: string) => `<svg class="kg-ccm-icon ${name}" viewBox="-13 -13 26 26" aria-hidden="true">${ICON[name]}</svg>`;
