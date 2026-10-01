// <kg-fraction-bars>: equal-part bars the learner can shade and re-partition.
// Contract: docs/STUDIOS.md ("Engine contract").
import { digitsOf, fracHTML, type NumberFormat } from '../lib/display';
import { cellsFor, nextParts } from './fraction-bars-amount';
import { isTinted, nextPartsShowing, nextRows, totalCells } from './fraction-bars-grid';

export interface BarConfig {
  parts: number;
  /** Number of cells shaded at the start (filled from the start of the bar). */
  shaded?: number;
  /** What the learner may change: shade cells, change the number of parts, both, or nothing. */
  interactive?: 'shade' | 'parts' | 'both' | 'none';
  minParts?: number;
  maxParts?: number;
  /** The − and + buttons change the number of parts by this much (default 1), e.g. 3 → 6 → 9 → 12. */
  partsStep?: number;
  /**
   * Re-partitioning keeps the starting amount: cells are shaded only when the new number of parts can show it
   * exactly, and a marker line shows where the amount ends. The label shows "?" over the parts otherwise.
   */
  keepAmount?: boolean;
  /**
   * Cells pre-coloured in a second colour at the start of the bar ("what you already have"). The learner cannot
   * unshade them; they count as shaded. Re-partitioning skips part counts that cannot show them exactly.
   */
  given?: number;
  /**
   * Area model: the bar is `parts` columns split into `rows` rows; its state has rows × parts parts.
   * The − and + buttons then change the rows (minRows–maxRows, default 1–6) and clear the learner's shading.
   */
  rows?: number;
  minRows?: number;
  maxRows?: number;
  /** Area model: tint the first `tint` columns (e.g. the ⅔ you take half of). Tinted cells do not count as shaded. */
  tint?: number;
}

export interface FractionBarsConfig {
  bars: BarConfig[];
  /** Show the shaded fraction under each bar. */
  label?: boolean;
  /** Line the bars up one under another at the same width, to compare them. */
  compare?: boolean;
  /** Re-partition every bar together; the − and + buttons are shown on the first bar only. */
  linkParts?: boolean;
}

interface Bar { cfg: BarConfig; parts: number; cells: boolean[]; amount?: [number, number]; rows?: number; given?: number }

export class FractionBars extends HTMLElement {
  private bars: Bar[] = [];
  private cfg: FractionBarsConfig = { bars: [] };

  set config(c: FractionBarsConfig) {
    this.cfg = c;
    this.bars = c.bars.map((b) => ({
      cfg: b,
      parts: b.parts,
      cells: Array.from({ length: totalCells(b.parts, b.rows) }, (_, i) => i < (b.shaded ?? 0) || i < (b.given ?? 0)),
      amount: b.keepAmount ? [b.shaded ?? 0, b.parts] as [number, number] : undefined,
      rows: b.rows,
      given: b.given,
    }));
    // An attribute, not a class: the studio runtime sets className after config.
    this.toggleAttribute('compare', !!c.compare);
    this.toggleAttribute('link-parts', !!c.linkParts);
    this.render();
  }

  get state() {
    return { bars: this.bars.map((b) => ({ parts: totalCells(b.parts, b.rows), shaded: b.cells.filter(Boolean).length })) };
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
    if (bar.given !== undefined) {
      // Given cells keep their amount; the learner's own cells are kept when they scale exactly, otherwise cleared.
      const g = cellsFor(bar.given, bar.parts, parts) ?? 0;
      const mine = cellsFor(bar.cells.filter(Boolean).length - bar.given, bar.parts, parts);
      bar.parts = parts;
      bar.given = g;
      bar.cells = Array.from({ length: parts }, (_, i) => i < g + (mine ?? 0));
      this.render();
      this.changed();
      return;
    }
    if (bar.amount) {
      // keepAmount: shade from the remembered amount, so 1/3 → (4 parts: none) → 6 parts: 2/6.
      const k = cellsFor(bar.amount[0], bar.amount[1], parts);
      bar.parts = parts;
      bar.cells = Array.from({ length: parts }, (_, i) => k !== null && i < k);
      this.render();
      this.changed();
      return;
    }
    // Keep the shaded amount when the new partition can show it exactly (e.g. 2/4 → 4/8), otherwise clear.
    const shaded = bar.cells.filter(Boolean).length;
    const scaled = (shaded * parts) / bar.parts;
    bar.parts = parts;
    bar.cells = Array.from({ length: parts }, (_, i) => Number.isInteger(scaled) && i < scaled);
    this.render();
    this.changed();
  }

  /** Area model: change the number of rows; the learner's shading is cleared. */
  private setRows(bar: Bar, rows: number) {
    bar.rows = rows;
    bar.cells = Array.from({ length: totalCells(bar.parts, rows) }, () => false);
    this.render();
    this.changed();
  }

  /** + / − on a bar: area-model rows, given-aware parts, or plain parts; linkParts applies it to every bar. */
  private step(bar: Bar, delta: 1 | -1) {
    const c = bar.cfg;
    if (bar.rows !== undefined) {
      const r = nextRows(bar.rows, delta, c.minRows ?? 1, c.maxRows ?? 6);
      if (r !== null) this.setRows(bar, r);
      return;
    }
    const next = bar.given !== undefined
      ? nextPartsShowing(bar.parts, delta, bar.given, bar.parts, c.partsStep, c.minParts ?? 1, c.maxParts ?? 12)
      : nextParts(bar.parts, delta, c.partsStep, c.minParts ?? 1, c.maxParts ?? 12);
    if (next === null) return;
    for (const b of this.cfg.linkParts ? this.bars : [bar]) this.setParts(b, next);
  }

  private render() {
    const label = this.dataset.labelCell ?? 'part';
    const labelFewer = this.dataset.labelFewer ?? 'fewer parts';
    const labelMore = this.dataset.labelMore ?? 'more parts';
    // With several bars and a studio-provided bar name, controls say which bar they belong to.
    const labelBar = this.bars.length > 1 ? this.dataset.labelBar : undefined;
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
      if (bar.parts > 12) strip.classList.add('many');
      if (bar.rows !== undefined) strip.classList.add('grid');
      const barName = labelBar ? `${labelBar} ${digitsOf(bi + 1, this.fmt)}` : '';
      if (barName) { strip.setAttribute('role', 'group'); strip.setAttribute('aria-label', barName); }
      if (bar.amount && bar.amount[1] > 0) {
        const mark = document.createElement('span');
        mark.className = 'kg-fb-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.style.insetInlineStart = `${(100 * bar.amount[0]) / bar.amount[1]}%`;
        strip.append(mark);
      }
      bar.cells.forEach((on, ci) => {
        const isGiven = ci < (bar.given ?? 0);
        const cell = document.createElement(canShade && !isGiven ? 'button' : 'span');
        cell.className = 'kg-fb-cell' + (on ? ' on' : '') + (isGiven ? ' given' : '') + (isTinted(ci, bar.parts, bar.cfg.tint) ? ' tint' : '');
        if (cell instanceof HTMLButtonElement) {
          cell.type = 'button';
          cell.setAttribute('aria-pressed', String(on));
          cell.setAttribute('aria-label', `${label} ${ci + 1}`);
          cell.addEventListener('click', () => {
            bar.cells[ci] = !bar.cells[ci];
            cell.classList.toggle('on', bar.cells[ci]);
            cell.setAttribute('aria-pressed', String(bar.cells[ci]));
            if (bar.amount) {
              bar.amount = [bar.cells.filter(Boolean).length, bar.parts];
              strip.querySelector<HTMLElement>('.kg-fb-mark')?.style.setProperty('inset-inline-start', `${(100 * bar.amount[0]) / bar.amount[1]}%`);
            }
            this.updateLabel(row, bar);
            this.changed();
          });
        }
        strip.append(cell);
      });

      if (canParts && !(this.cfg.linkParts && bi > 0)) {
        const ctl = document.createElement('div');
        ctl.className = 'kg-fb-parts';
        const grid = bar.rows !== undefined;
        const mk = (text: string, aria: string, delta: 1 | -1) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = text;
          b.setAttribute('aria-label', barName ? `${aria}, ${barName}` : aria);
          b.addEventListener('click', () => {
            if (grid || bar.given !== undefined || this.cfg.linkParts) return this.step(bar, delta);
            const next = nextParts(bar.parts, delta, bar.cfg.partsStep, bar.cfg.minParts ?? 1, bar.cfg.maxParts ?? 12);
            if (next !== null) this.setParts(bar, next);
          });
          return b;
        };
        const count = document.createElement('output');
        count.textContent = digitsOf(grid ? bar.rows! : bar.parts, this.fmt);
        if (grid) ctl.classList.add('rows');
        ctl.append(
          mk('−', grid ? this.dataset.labelFewerRows ?? labelFewer : labelFewer, -1), count,
          mk('+', grid ? this.dataset.labelMoreRows ?? labelMore : labelMore, +1),
        );
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
    if (!out) return;
    const shaded = bar.cells.filter(Boolean).length;
    // keepAmount on a partition that cannot show the amount: "?" rather than a misleading 0.
    const n = bar.amount && cellsFor(bar.amount[0], bar.amount[1], bar.parts) === null ? '?' : shaded;
    out.innerHTML = fracHTML(n, totalCells(bar.parts, bar.rows), this.fmt);
  }
}

customElements.define('kg-fraction-bars', FractionBars);
