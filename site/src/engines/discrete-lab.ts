// <kg-discrete-lab>: sets, Venn diagrams and two-way tables (later: probability trees).
//   venn:  element cards and set ovals inside the universal rectangle. Drag (or tap, then tap a region; or use the
//          region buttons from the keyboard) cards into regions, nest one oval in another for ⊆, tap regions to shade
//          A ∪ B, A ∩ B, A − B, A′, type region counts, and flip the same data into a two-way table (discrete-lab/venn.ts)
//   table: a two-way table with totals; the learner fills cells or totals (discrete-lab/table.ts)
// Every mode can add, under the view: sets written in braces from a card tray, and statement rows such as
// "{۴} ☐ A" with ∈ / ⊆ / = buttons, or "is this set finite?" (discrete-lab/panels.ts).
// Contract: docs/STUDIOS.md ("Engine contract", "Engine options → discrete-lab"). Maths and checks:
// engines/lib/discrete-lab-sets.ts and engines/lib/discrete-lab-check.ts. Set notation runs left to right in every
// locale (docs/NOTATION.md "Sets").
//
// Extension point for modules: a mode is a file in discrete-lab/ exporting mount(host, cfg) → View; add it to MODES.
// The `tree` module (prob-trees-counting) plugs in as `tree: () => import('./discrete-lab/tree')`, puts its state
// under `sets.tree` and its condition `tree` into lib/discrete-lab-check.ts.
import type { SetsState } from './lib/discrete-lab-check';
import { setSep } from '../lib/display';
import { camel, esc, type Host, type View } from './discrete-lab/dom';
import { mountPanels, type PanelsConfig } from './discrete-lab/panels';
import type { VennConfig } from './discrete-lab/venn';
import type { TableConfig } from './discrete-lab/table';

type Mount = { mount(host: Host, cfg: DiscreteConfig): View };
const MODES: Record<string, () => Promise<Mount>> = {
  venn: () => import('./discrete-lab/venn'),
  table: () => import('./discrete-lab/table'),
  /** Only the panels (statement rows, sets in braces), no drawing. */
  none: async () => ({ mount: () => ({ root: document.createElement('div'), state: () => ({}) }) }),
};

export type DiscreteConfig = {
  /** Default: table if `table` is given, else venn. `none`: only the panels (statement rows, sets in braces). */
  mode?: 'venn' | 'table' | 'none' | string;
  /** Icon hint + label `instruction-<name>`: drag, shade, write, pick, count, nest, fill. */
  instruction?: string;
} & VennConfig & TableConfig & PanelsConfig;

let uid = 0;

export class DiscreteLab extends HTMLElement implements Host {
  uid = `kg-dl${++uid}`;
  private view?: View;
  private panels?: View;
  private live = document.createElement('p');
  /** Resolves once the mode's view is drawn. */
  ready: Promise<void> = Promise.resolve();

  set config(c: DiscreteConfig) {
    const mode = c.mode ?? (c.table ? 'table' : 'venn');
    this.dataset.mode = mode;
    this.view = this.panels = undefined;
    this.live.className = 'kg-dl-live';
    this.live.setAttribute('aria-live', 'polite');
    this.ready = (MODES[mode] ?? MODES.venn)().then((m) => {
      this.view = m.mount(this, c);
      this.panels = mountPanels(this, c, () => this.view?.state().members ?? {});
      const nodes: Node[] = [this.view.root, this.panels.root, this.live];
      if (c.instruction) {
        const p = document.createElement('p');
        p.className = 'kg-dl-hint';
        p.innerHTML = `<span class="kg-dl-i i-${esc(c.instruction)}" aria-hidden="true"></span>${this.lbl(`instruction-${c.instruction}`)}`;
        nodes.unshift(p);
      }
      this.replaceChildren(...nodes);
    });
  }

  /** `{ sets }`, nested so its keys never clash with other engines' state in lib/checks.ts. */
  get state(): { sets: SetsState } {
    return { sets: { ...(this.view?.state() ?? {}), ...(this.panels?.state() ?? {}) } };
  }

  d = (n: number | string) => String(n).replace(/[0-9]/g, (x) => (this.dataset.digits ?? '0123456789')[+x]);

  lbl(k: string, fb = '', v: Record<string, string | number> = {}) {
    return esc(this.dataset[camel(k)] ?? fb).replace(/\{(\w)\}/g, (m, x: string) =>
      x in v ? (typeof v[x] === 'number' ? this.d(v[x]) : String(v[x])) : m);
  }

  item = (k: string) => (/^-?\d+$/.test(k) ? this.d(k) : this.lbl(`item-${k}`, k));

  math(s: string) {
    const sep = setSep({ digits: '', decimal: this.dataset.decimal ?? '.' });
    const t = esc(s.trim()).replace(/\{([^}]*)\}/g, (_, in_: string) => `{${in_.split(/[,،]/).map((x) => this.item(x.trim())).filter(Boolean).join(sep)}}`);
    return `<bdi dir="ltr" class="kg-dl-m">${this.d(t)}</bdi>`;
  }

  text(s: string) {
    return s.replace(/\{[^}]*\}/g, (m) => `<bdi dir="ltr">${m}</bdi>`);
  }

  say(t: string) {
    const p = document.createElement('p');
    p.innerHTML = t;
    this.live.textContent = p.textContent;
  }

  changed() {
    this.dispatchEvent(new CustomEvent('kg-change', { bubbles: true, detail: this.state }));
  }
}

customElements.define('kg-discrete-lab', DiscreteLab);
