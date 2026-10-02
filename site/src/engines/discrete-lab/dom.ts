// Shared helpers for the views of <kg-discrete-lab> (venn.ts, table.ts, panels.ts; later tree.ts).
// The views live in this folder, not in engines/, so the engine registry does not mistake them for engines,
// and each page loads only the view its missions use.
import type { SetsState } from '../lib/discrete-lab-check';

/** What a view needs from the element: digits, labels, set notation and the change event. */
export interface Host {
  dataset: DOMStringMap;
  /** Unique prefix for SVG ids (clip paths, masks) on this element. */
  uid: string;
  /** Locale digits. */
  d(n: number | string): string;
  /** A label from the studio's "engine" text, HTML-escaped, with {placeholders} (numbers get locale digits). */
  lbl(key: string, fallback?: string, vars?: Record<string, string | number>): string;
  /** An element's name: a number in locale digits, or the label item-<key>. Escaped. */
  item(k: string): string;
  /** Set notation as LTR HTML: "{2, 4}" → {۲, ۴}, "A ∪ B" stays as it is; digits and separator per locale. */
  math(s: string): string;
  /** Plain text with any {…} braces kept left to right (statement labels such as «{x | x زوج است}»). */
  text(s: string): string;
  /** Read a screen-reader announcement aloud. */
  say(text: string): void;
  changed(): void;
}

export interface View {
  root: HTMLElement;
  state(): Partial<SetsState>;
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const camel = (k: string) => k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

/** Keep the focused control focused across a redraw: controls carry a stable data-k. */
export function redraw(root: HTMLElement, html: string) {
  const ae = document.activeElement as HTMLElement | null;
  const k = ae && root.contains(ae) ? ae.dataset.k : undefined;
  root.innerHTML = html;
  if (k) root.querySelector<HTMLElement>(`[data-k="${CSS.escape(k)}"]`)?.focus();
}
