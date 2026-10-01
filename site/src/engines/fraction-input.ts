// <kg-fraction-input>: a stacked numerator/denominator input (optionally with a whole part).
// Accepts Persian, Arabic-Indic or ASCII digits; never asks the learner to type "/".
import { parseInteger, type WrittenFrac } from '../lib/fraction';

export class FractionInput extends HTMLElement {
  private n!: HTMLInputElement;
  private d!: HTMLInputElement;
  private w?: HTMLInputElement;

  connectedCallback() {
    if (this.n) return;
    const box = (name: string, label: string) => {
      const i = document.createElement('input');
      i.inputMode = 'numeric';
      i.autocomplete = 'off';
      i.className = `kg-fi-${name}`;
      i.setAttribute('aria-label', label);
      i.addEventListener('input', () => this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true })));
      return i;
    };
    const wrap = document.createElement('bdi');
    wrap.dir = 'ltr';
    wrap.className = 'kg-fi';
    if (this.hasAttribute('whole')) {
      this.w = box('w', this.dataset.labelWhole ?? 'whole number');
      wrap.append(this.w);
    }
    const stack = document.createElement('span');
    stack.className = 'kg-fi-stack';
    this.n = box('n', this.dataset.labelNumerator ?? 'numerator');
    this.d = box('d', this.dataset.labelDenominator ?? 'denominator');
    stack.append(this.n, this.d);
    wrap.append(stack);
    this.append(wrap);
  }

  /** The fraction as written, or null if incomplete. */
  get value(): WrittenFrac | null {
    const n = parseInteger(this.n.value), d = parseInteger(this.d.value);
    if (n === null || d === null) return null;
    const whole = this.w && this.w.value.trim() ? parseInteger(this.w.value) : undefined;
    if (whole === null) return null;
    return whole === undefined ? { n, d } : { n, d, whole };
  }

  clear() {
    for (const i of [this.n, this.d, this.w]) if (i) i.value = '';
  }

  focus() {
    (this.w ?? this.n).focus();
  }
}

customElements.define('kg-fraction-input', FractionInput);
