// <kg-fraction-bars>: equal-part bars the learner can shade and re-partition.
// Contract: docs/STUDIOS.md ("Engine contract").
import { digitsOf, fracHTML, type NumberFormat } from '../lib/display';

export interface BarConfig {
  parts: number;
  /** Number of cells shaded at the start (filled from the start of the bar). */
  shaded?: number;
  /** What the learner may change: shade cells, change the number of parts, both, or nothing. */
  interactive?: 'shade' | 'parts' | 'both' | 'none';
  minParts?: number;
  maxParts?: number;
}

export interface FractionBarsConfig {
  bars: BarConfig[];
  /** Show the shaded fraction under each bar. */
  label?: boolean;
}

interface Bar { cfg: BarConfig; parts: number; cells: boolean[] }

export class FractionBars extends HTMLElement {
  private bars: Bar[] = [];
  private cfg: FractionBarsConfig = { bars: [] };

  set config(c: FractionBarsConfig) {
    this.cfg = c;
    this.bars = c.bars.map((b) => ({
      cfg: b,
      parts: b.parts,
      cells: Array.from({ length: b.parts }, (_, i) => i < (b.shaded ?? 0)),
    }));
    this.render();
  }

  get state() {
    return { bars: this.bars.map((b) => ({ parts: b.parts, shaded: b.cells.filter(Boolean).length })) };
  }

  private get fmt(): NumberFormat {
    return { digits: this.dataset.digits ?? '0123456789', decimal: this.dataset.decimal ?? '.' };
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }

  private setParts(bar: Bar, parts: number) {
    const min = bar.cfg.minParts ?? 1, max = bar.cfg.maxParts ?? 12;
    if (parts < min || parts > max) return;
    // Keep the shaded amount when the new partition can show it exactly (e.g. 2/4 → 4/8), otherwise clear.
    const shaded = bar.cells.filter(Boolean).length;
    const scaled = (shaded * parts) / bar.parts;
    bar.parts = parts;
    bar.cells = Array.from({ length: parts }, (_, i) => Number.isInteger(scaled) && i < scaled);
    this.render();
    this.changed();
  }

  private render() {
    const label = this.dataset.labelCell ?? 'part';
    const labelFewer = this.dataset.labelFewer ?? 'fewer parts';
    const labelMore = this.dataset.labelMore ?? 'more parts';
    this.innerHTML = '';
    this.bars.forEach((bar, bi) => {
      const row = document.createElement('div');
      row.className = 'kg-fb-row';
      const mode = bar.cfg.interactive ?? 'shade';
      const canShade = mode === 'shade' || mode === 'both';
      const canParts = mode === 'parts' || mode === 'both';

      const strip = document.createElement('div');
      strip.className = 'kg-fb-bar';
      strip.style.gridTemplateColumns = `repeat(${bar.parts}, 1fr)`;
      bar.cells.forEach((on, ci) => {
        const cell = document.createElement(canShade ? 'button' : 'span');
        cell.className = 'kg-fb-cell' + (on ? ' on' : '');
        if (cell instanceof HTMLButtonElement) {
          cell.type = 'button';
          cell.setAttribute('aria-pressed', String(on));
          cell.setAttribute('aria-label', `${label} ${ci + 1}`);
          cell.addEventListener('click', () => {
            bar.cells[ci] = !bar.cells[ci];
            cell.classList.toggle('on', bar.cells[ci]);
            cell.setAttribute('aria-pressed', String(bar.cells[ci]));
            this.updateLabel(row, bar);
            this.changed();
          });
        }
        strip.append(cell);
      });

      if (canParts) {
        const ctl = document.createElement('div');
        ctl.className = 'kg-fb-parts';
        const mk = (text: string, aria: string, delta: number) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = text;
          b.setAttribute('aria-label', aria);
          b.addEventListener('click', () => this.setParts(bar, bar.parts + delta));
          return b;
        };
        const count = document.createElement('output');
        count.textContent = digitsOf(bar.parts, this.fmt);
        ctl.append(mk('−', labelFewer, -1), count, mk('+', labelMore, +1));
        row.append(ctl);
      }
      row.prepend(strip);
      if (this.cfg.label) {
        const out = document.createElement('div');
        out.className = 'kg-fb-label';
        out.setAttribute('aria-live', 'polite');
        row.append(out);
        this.updateLabel(row, bar);
      }
      row.dataset.bar = String(bi);
      this.append(row);
    });
  }

  private updateLabel(row: HTMLElement, bar: Bar) {
    const out = row.querySelector('.kg-fb-label');
    if (out) out.innerHTML = fracHTML(bar.cells.filter(Boolean).length, bar.parts, this.fmt);
  }
}

customElements.define('kg-fraction-bars', FractionBars);
