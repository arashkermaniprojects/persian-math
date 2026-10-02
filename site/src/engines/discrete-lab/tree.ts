// Module `tree` of <kg-discrete-lab>: tree diagrams, loaded only when a mission's setup has `tree` (or mode: tree).
// The drawing runs left to right in every locale, root on the left, as in Afghan G8 «دیاگرام درختی» and the UK books.
// The learner can grow the tree (tap + on a node; or choose which branches grow, for "without replacement"), write
// probabilities on branches and path products at the leaves (a branch or leaf chip opens a stacked fraction editor
// under the drawing), tap leaves to choose an event, and fill the counts of a frequency tree.
// Options and maths: engines/lib/discrete-lab-tree.ts; check: the `tree` condition of check type `sets`.
import {
  allPaths, altProb, asked, childOf, children, depthOf, exhausted, lastOf, layoutTree, options, parentOf, pathProd, pathSum, prob,
  stageCount, stageSum, type Frac, type TreeConfig, type TreeState,
} from '../lib/discrete-lab-tree';
import { toAscii } from '../lib/discrete-lab-sets';
import { esc, redraw, type Host, type View } from './dom';

export interface TreeViewConfig { tree?: TreeConfig }

const W = 360;
const COLORS: Record<string, string> = {
  red: '#d9473b', blue: '#2f7fd1', green: '#3a9a4f', yellow: '#e8b400', black: '#2b2b2b', grey: '#8c8c8c', white: '#fff', orange: '#ee8a1b', purple: '#8a4fc7',
};
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(2)}%`;
const num = (s = '') => {
  const v = toAscii(s.trim());
  return /^\d+$/.test(v) ? +v : null;
};

export function mount(host: Host, cfg: TreeViewConfig): View {
  const c: TreeConfig = cfg.tree ?? { stages: [] };
  const D = stageCount(c), freq = !!c.values, P = (p: string) => prob(c, p);
  const truth = allPaths(c);
  /** The learner's tree: the branches of each grown node. */
  const grown: Record<string, string[]> = {};
  for (const p of truth) if (depthOf(p) < (c.grow ? c.given ?? 0 : D)) grown[p] = children(c, p);
  const kids = (p: string) => grown[p] ?? [];
  const nodes = (p = ''): string[] => [p, ...kids(p).flatMap((k) => nodes(childOf(p, k)))];
  const askP = asked(c.ask?.p, truth.slice(1));
  const askX = asked(c.ask?.product, truth.filter((p) => depthOf(p) === D));
  const askN = asked(c.ask?.count, truth);
  const showP = c.show?.p !== false, showX = !!c.show?.product || askX.length > 0;
  /** What the learner typed: "p:<path>" a branch, "x:<path>" a path product ([numerator, denominator]), "n:<path>" a count. */
  const raw: Record<string, string[]> = {};
  const picked = new Set<string>();
  let sel: { k: string; path: string } | null = null;
  const frac = (key: string): Frac | null => {
    const n = num(raw[key]?.[0]), d = num(raw[key]?.[1]);
    return n == null || d == null ? null : [n, d];
  };

  const root = document.createElement('div');
  root.className = 'kg-dl-treev';
  const dia = document.createElement('div');
  const ed = document.createElement('div');
  ed.className = 'kg-dl-ed';
  root.append(dia, ed);

  const name = (p: string): string => (p ? p.split('.').map(host.item).reduce((a, b) => host.lbl('label-then', '{a}, then {b}', { a, b })) : host.lbl('label-start', 'start'));
  const fr = (f: Frac | null) => (f ? `<span class="kg-dl-fr"><span>${host.d(f[0])}</span><span>${host.d(f[1])}</span></span>` : '?');
  const said = (f: Frac | null) => (f ? host.lbl('label-frac', '{n} over {d}', { n: f[0], d: f[1] }) : host.lbl('label-empty', 'empty'));
  const what = (k: string, p: string) => host.lbl(k === 'p' ? 'label-branch' : k === 'x' ? 'label-path' : k === 'n' ? 'label-node' : 'label-grow',
    k === 'p' ? 'probability on the branch {b}' : k === 'x' ? 'probability of {b}' : k === 'n' ? 'number for {b}' : 'branches from {b}', { b: name(p) });
  const chip = (k: string, p: string, x: number, y: number, h: number, body: string, spoken: string) =>
    `<button type="button" class="kg-dl-tc${sel?.k === k && sel.path === p ? ' on' : ''}" data-a="${k}" data-p="${esc(p)}" data-k="${k}${esc(p)}" style="left:${pct(x, W)};top:${pct(y, h)}" aria-label="${what(k, p)}: ${spoken}">${body}</button>`;

  const draw = () => {
    const ns = nodes();
    const hasP = askP.length > 0 || (showP && truth.some((p) => p && P(p)));
    const L = layoutTree(kids, D, { gap: freq ? 64 : hasP ? 76 : 56, reserve: freq ? 30 : showX ? 140 : 100 });
    const h = L.h, at = (x: number, y: number) => `left:${pct(x, W)};top:${pct(y, h)}`;
    let svg = '', html = '';
    for (const p of ns) {
      const [x, y] = L.pos[p], d = depthOf(p), k = lastOf(p);
      if (p) {
        const [px, py] = L.pos[parentOf(p)];
        svg += `<line class="kg-dl-tl" x1="${px}" y1="${py}" x2="${x}" y2="${y}"/>`;
        const t = freq || d < D ? 0.5 : 0.66, bx = px + (x - px) * t, by = py + (y - py) * t;
        if (freq) html += `<span class="kg-dl-tn mid" style="${at(bx, by)}">${host.item(k)}</span>`;
        else if (askP.includes(p)) html += chip('p', p, bx, by, h, fr(frac(`p:${p}`)), said(frac(`p:${p}`)));
        else if (showP && P(p)) html += `<span class="kg-dl-tp" style="${at(bx, by)}">${fr(P(p))}</span>`;
      }
      if (freq) {
        const v = c.values![p];
        html += askN.includes(p) ? chip('n', p, x, y, h, raw[`n:${p}`]?.[0] ? host.d(num(raw[`n:${p}`][0]) ?? '?') : '?', raw[`n:${p}`]?.[0] ?? host.lbl('label-empty', 'empty'))
          : `<span class="kg-dl-tv" style="${at(x, y)}">${v == null ? '' : host.d(v)}</span>`;
      } else {
        const col = COLORS[c.colors?.[k] ?? ''];
        svg += `<circle class="kg-dl-td" cx="${x}" cy="${y}" r="${p ? 8 : 6}"${p && col ? ` style="fill:${col}"` : ''}/>`;
        if (p && d === D) {
          html += c.pick
            ? `<button type="button" class="kg-dl-tn leaf pick" data-a="pick" data-p="${esc(p)}" data-k="k${esc(p)}" aria-pressed="${picked.has(p)}" aria-label="${name(p)}" style="${at(x + 12, y)}">${host.item(k)}</button>`
            : `<span class="kg-dl-tn leaf" style="${at(x + 12, y)}">${host.item(k)}</span>`;
        } else if (p) html += `<span class="kg-dl-tn in" style="${at(x - 16, y - 16)}">${host.item(k)}</span>`;
      }
      if (c.grow && d < D && (c.grow === 'choose' || !kids(p).length)) {
        html += `<button type="button" class="kg-dl-grow${kids(p).length ? ' done' : ''}${sel?.k === 'g' && sel.path === p ? ' on' : ''}" data-a="g" data-p="${esc(p)}" data-k="g${esc(p)}" style="${at(x, y)}" aria-label="${what('g', p)}">${kids(p).length ? '' : '+'}</button>`;
      }
      if (showX && d === D) {
        const f = frac(`x:${p}`);
        html += askX.includes(p) ? chip('x', p, W - 30, y, h, fr(f), said(f))
          : `<span class="kg-dl-tp" style="${at(W - 30, y)}">${fr(pathProd(p, P))}</span>`;
      }
    }
    redraw(dia, `<div class="kg-dl-tbox${freq ? ' freq' : ''}" dir="ltr" style="aspect-ratio:${W}/${h}"><svg class="kg-dl-tsvg" viewBox="0 0 ${W} ${h}" aria-hidden="true">${svg}</svg>${html}</div>`);
  };

  const edit = () => {
    if (!sel) return void (ed.innerHTML = '');
    const { k, path } = sel, key = `${k}:${path}`, v = raw[key] ?? [];
    const box = (i: number, lbl: string) => `<input class="kg-dl-cnt" inputmode="numeric" autocomplete="off" data-f="${i}" data-k="f${i}" value="${esc(v[i] ?? '')}" aria-label="${lbl}">`;
    const body = k === 'g'
      ? `<div class="kg-dl-opts" role="group">${options(c, depthOf(path)).map((o) => `<button type="button" class="kg-dl-opt" data-a="o" data-o="${esc(o)}" data-k="o${esc(o)}" aria-pressed="${kids(path).includes(o)}">${host.item(o)}</button>`).join('')}</div>`
      : k === 'n' ? box(0, what(k, path))
        : `<bdi dir="ltr" class="kg-dl-fi">${box(0, host.lbl('label-num', 'numerator'))}<span class="kg-dl-bar"></span>${box(1, host.lbl('label-den', 'denominator'))}</bdi>`;
    redraw(ed, `<p class="kg-dl-edt">${what(k, path)}</p>${body}`);
  };

  /** A chip or + was tapped: select it and open its editor. */
  const open = (k: string, path: string) => {
    sel = { k, path };
    draw();
    edit();
    ed.querySelector<HTMLElement>('input, button')?.focus();
  };

  dia.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-a]');
    if (!b) return;
    const { a, p = '' } = b.dataset;
    if (a === 'pick') {
      picked.has(p) ? picked.delete(p) : picked.add(p);
      draw();
    } else if (a === 'g' && c.grow !== 'choose') {
      grown[p] = children(c, p);
      host.say(host.lbl('label-grown', '{n} branches from {b}', { n: grown[p].length, b: name(p) }));
      draw();
      dia.querySelector<HTMLElement>('[data-a="g"]')?.focus();
    } else return open(a!, p);
    host.changed();
  });

  ed.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-a="o"]');
    if (!b || !sel) return;
    const p = sel.path, o = b.dataset.o!, has = kids(p).includes(o);
    if (has) {
      // Cut the branch and everything that grew from it.
      const cut = childOf(p, o);
      for (const q of Object.keys(grown)) if (q === cut || q.startsWith(`${cut}.`)) delete grown[q];
      for (const q of [...picked]) if (q === cut || q.startsWith(`${cut}.`)) picked.delete(q);
    }
    const next = options(c, depthOf(p)).filter((x) => (x === o ? !has : kids(p).includes(x)));
    if (next.length) grown[p] = next;
    else delete grown[p];
    draw();
    edit();
    host.changed();
  });

  ed.addEventListener('input', (e) => {
    const i = e.target as HTMLInputElement;
    if (!sel || !i.dataset.f) return;
    const key = `${sel.k}:${sel.path}`;
    (raw[key] ??= [])[+i.dataset.f] = i.value;
    draw();
    host.changed();
  });
  ed.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT')) && sel) {
      dia.querySelector<HTMLElement>(`[data-k="${CSS.escape((sel.k === 'g' ? 'g' : sel.k) + sel.path)}"]`)?.focus();
    }
  });

  draw();

  return {
    root,
    state: () => {
      const ns = nodes();
      const t: TreeState = {
        leaves: ns.filter((p) => depthOf(p) === D).length,
        sum: stageSum(c),
        nodes: ns.filter((p) => depthOf(p) < D).map((p) => ({ path: p, got: [...kids(p)], truth: children(c, p), gone: exhausted(c, p) })),
        p: {}, product: {}, count: {}, picked: [...picked],
      };
      for (const p of ns.slice(1)) {
        const f = P(p);
        if (f) t.p[p] = { ask: askP.includes(p), got: frac(`p:${p}`), truth: f, alt: altProb(c, p) };
      }
      for (const p of askX) {
        t.product[p] = { got: frac(`x:${p}`), truth: pathProd(p, P) ?? [0, 1], add: pathSum(p, P), alt: c.bag && c.replace === false ? pathProd(p, (q) => altProb(c, q)) : null };
      }
      if (freq) for (const p of ns) t.count[p] = { ask: askN.includes(p), got: num(raw[`n:${p}`]?.[0]), truth: c.values![p] ?? 0 };
      return { tree: t };
    },
  };
}
