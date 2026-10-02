// Two-way table view of <kg-discrete-lab>: rows × columns with totals, in the page direction (tables follow the page,
// docs/NOTATION.md "Charts"). The learner fills the cells listed in `ask`; the rest are shown. venn.ts reuses
// twoWay() to flip a diagram into the same table.
import { tableValue, toAscii } from '../lib/discrete-lab-sets';
import { esc, type Host, type View } from './dom';

export interface TableConfig {
  table?: {
    /** Row and column headings: set names (A, A′) are written as set notation, other keys use label head-<key>. */
    rows: string[];
    cols: string[];
    /** The counts in the body of the table (totals are worked out). */
    values: number[][];
    /** Cells the learner fills: "r,c" (0-based), "r,t" a row total, "t,c" a column total, "t,t" the grand total. */
    ask?: string[];
  };
}

const head = (host: Host, k: string) => (/^[A-Z][′']?$/.test(k) ? host.math(k) : host.lbl(`head-${k}`, k));

/** The table's HTML; `cell(key)` gives each cell's content ("r,c", "r,t", "t,c", "t,t"). */
export function twoWay(host: Host, rows: string[], cols: string[], cell: (key: string) => string): string {
  const total = host.lbl('label-total', 'Total');
  const ks = [...cols.map((_, j) => String(j)), 't'];
  const tr = (r: string, name: string) => `<tr><th scope="row">${name}</th>${ks.map((c) => `<td>${cell(`${r},${c}`)}</td>`).join('')}</tr>`;
  return `<table class="kg-dl-table"><tr><td></td>${cols.map((c) => `<th scope="col">${head(host, c)}</th>`).join('')}<th scope="col">${total}</th></tr>` +
    rows.map((r, i) => tr(String(i), head(host, r))).join('') + tr('t', total) + '</table>';
}

export function mount(host: Host, c: TableConfig): View {
  const t = c.table ?? { rows: [], cols: [], values: [] };
  const ask = t.ask ?? [];
  const cells: Record<string, number | null> = Object.fromEntries(ask.map((k) => [k, null]));
  const root = document.createElement('div');
  root.className = 'kg-dl-tablev';
  const name = (k: string) => {
    const [r, col] = k.split(',');
    const rn = r === 't' ? host.lbl('label-total', 'Total') : esc(t.rows[+r]);
    const cn = col === 't' ? host.lbl('label-total', 'Total') : esc(t.cols[+col]);
    return host.lbl('label-cell', '{r}, {c}', { r: rn, c: cn });
  };
  root.innerHTML = twoWay(host, t.rows, t.cols, (k) => ask.includes(k)
    ? `<input class="kg-dl-cnt" inputmode="numeric" autocomplete="off" data-cell="${k}" data-k="i${k}" aria-label="${name(k)}">`
    : host.d(tableValue(t.values, k)));
  root.addEventListener('input', (e) => {
    const i = e.target as HTMLInputElement;
    if (!i.dataset.cell) return;
    const v = toAscii(i.value.trim());
    cells[i.dataset.cell] = /^\d+$/.test(v) ? +v : null;
    host.changed();
  });
  return {
    root,
    state: () => ({ table: { cells: { ...cells }, truth: Object.fromEntries(ask.map((k) => [k, tableValue(t.values, k)])) } }),
  };
}
