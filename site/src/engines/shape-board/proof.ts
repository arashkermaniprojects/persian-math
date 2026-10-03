// Proof panel for <kg-shape-board>, loaded only by missions whose setup has `proof` (with a `dynamic` figure, drawn by
// shape-board/dynamic.ts). The learner taps marked sides and angles on the figure to write "AB = AD" rows, picks each
// row's reason from the locale's bank, fills the vertex correspondence △ABC ≅ △___, picks a congruence criterion, or
// drags the figure into a counterexample to a claim. Rows run given → statement → reason. Logic: ../lib/shape-board-proof.ts.
import type { ShapeBoard, ShapeBoardConfig } from '../shape-board';
import type { ShapeBoardState } from '../lib/shape-board-check';
import { toks, type DynamicConfig } from '../lib/shape-board-dynamic';
import type { ProofConfig, Row } from '../lib/shape-board-proof';
import { mountDynamic, type Map } from './dynamic';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function mountProof(host: ShapeBoard, cfg: ShapeBoardConfig) {
  const pc = (cfg.proof ?? {}) as ProofConfig, parts = pc.parts ?? [], max = pc.rows ?? 0;
  const letter = (n: string) => host.lab(`letter-${n}`, n), word = (p: string) => toks(p).map(letter).join('');
  // an angle is named by its vertex alone (∠B) unless two marked angles share that vertex
  const vtx = parts.filter((p) => toks(p).length === 3).map((p) => toks(p)[1]);
  const named = (p: string) => {
    const t = toks(p);
    if (t.length !== 3) return word(p);
    return host.lab('label-angle-sign', '∠') + (vtx.filter((v) => v === t[1]).length > 1 ? word(p) : letter(t[1]));
  };
  /** A statement as the books write it, left to right: AB = AD, ∠B = ∠D, △ABC ≅ △ADC. */
  const show = (s: string) => {
    if (s.includes('≅')) return s.split('≅').map((x) => '△' + word(x.trim())).join(' ≅ ');
    return s.split('=').map((x) => named(x.trim())).join(' = ');
  };
  const rows: Row[] = (pc.given ?? []).map((r) => ({ ...r, locked: true }));
  let pend: string[] = [], criterion: string | null = null, corr: string[] = [];
  const mine = () => rows.filter((r) => !r.locked).length;

  const over = ({ sx, sy, pts }: Map) =>
    parts.map((p, i) => {
      const ps = toks(p).map((n) => pts[n]);
      if (ps.some((q) => !q)) return '';
      const on = pend.includes(p) ? ' on' : '', aria = esc(host.lab(ps.length === 3 ? 'label-angle' : 'label-side', '{p}', { p: named(p) }));
      let body: string;
      if (ps.length === 2) {
        // the middle of the side, so taps near a corner go to the angle there
        const [a, b] = ps as [number, number][], at = (t: number) => `x${t ? 2 : 1}="${sx(a[0] + (b[0] - a[0]) * (t ? 0.8 : 0.2))}" y${t ? 2 : 1}="${sy(a[1] + (b[1] - a[1]) * (t ? 0.8 : 0.2))}"`;
        body = `<line class="kg-pf-hit" ${at(0)} ${at(1)}/><line class="kg-pf-hl" ${at(0)} ${at(1)}/>`;
      } else {
        const [a, v, b] = ps as [number, number][], cx = sx(v[0]), cy = sy(v[1]);
        const ang = (q: number[]) => Math.atan2(sy(q[1]) - cy, sx(q[0]) - cx);
        let t0 = ang(a), d = ang(b) - t0;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const r = 40, end = (t: number) => `${(cx + r * Math.cos(t)).toFixed(1)},${(cy + r * Math.sin(t)).toFixed(1)}`;
        body = `<path class="kg-pf-sector" d="M${cx},${cy}L${end(t0)}A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${end(t0 + d)}Z"/>`;
      }
      return `<g class="kg-pf-part${on}" data-part="${i}" tabindex="0" role="button" aria-pressed="${!!on}" aria-label="${aria}">${body}</g>`;
    }).join('');

  const dyn = mountDynamic(host, { ...cfg, dynamic: cfg.dynamic ?? ({ points: {} } as DynamicConfig) }, over);
  const panel = document.createElement('div');
  panel.className = 'kg-pf';
  panel.dir = document.documentElement.dir || 'ltr';
  dyn.root.append(panel);

  const btn = (attrs: string, text: string, cls = 'secondary kg-sb-btn') => `<button type="button" class="${cls}" ${attrs}>${text}</button>`;
  const reasonName = (k: string) => esc(host.lab(`reason-${k}`, host.lab(`crit-${k}`, k)));
  const render = () => {
    let h = '';
    if (pc.claim) h += `<p class="kg-pf-claim">${host.lab(`claim-${pc.claim}`, '')}</p>`;
    if (pc.corr) {
      const of = toks(pc.corr.of), slots = of.map((_, i) => `<span class="kg-pf-slot${corr[i] ? '' : ' empty'}">${corr[i] ? esc(letter(corr[i])) : '?'}</span>`).join('');
      h += `<div class="kg-pf-corr"><bdi dir="ltr" class="kg-pf-tri" aria-live="polite">△${esc(word(pc.corr.of))} ≅ △${slots}</bdi>`
        + `<div class="kg-pf-keys" role="group" aria-label="${esc(host.lab('label-corr', ''))}">${toks(pc.corr.from).map((n) => btn(`data-v="${esc(n)}"${corr.length >= of.length ? ' disabled' : ''}`, esc(letter(n)), 'kg-sb-tile')).join('')}`
        + btn(`data-erase aria-label="${esc(host.lab('label-erase', 'Erase'))}"${corr.length ? '' : ' disabled'}`, '⌫', 'kg-sb-tile') + '</div></div>';
    }
    if (pc.criteria) h += `<div class="kg-sb-ask kg-pf-crit" role="radiogroup" aria-label="${esc(host.lab('label-criterion', ''))}">${pc.criteria.map((k) => `<button type="button" role="radio" class="kg-sb-tile" data-crit="${k}" aria-checked="${criterion === k}">${esc(host.lab(`crit-${k}`, k))}</button>`).join('')}</div>`;
    if (max || rows.length) {
      h += `<ol class="kg-pf-rows" aria-label="${esc(host.lab('label-rows', ''))}">${rows.map((r, i) => {
        const why = r.locked ? `<span class="kg-pf-why">${reasonName(r.r ?? '')}</span>`
          : `<select data-row="${i}" aria-label="${esc(host.lab('label-reason', 'Reason'))}: ${esc(show(r.s))}"><option value="">${esc(host.lab('label-choose', '…'))}</option>${(pc.reasons ?? []).map((k) => `<option value="${k}"${r.r === k ? ' selected' : ''}>${reasonName(k)}</option>`).join('')}</select>`
            + btn(`data-del="${i}" aria-label="${esc(host.lab('label-remove', 'Remove'))}: ${esc(show(r.s))}"`, '✕', 'secondary kg-sb-btn kg-pf-x');
        return `<li class="${r.locked ? 'given' : ''}"><span class="kg-pf-n" aria-hidden="true">${host.d(i + 1)}</span><bdi dir="ltr" class="kg-pf-st">${esc(show(r.s))}</bdi>${why}</li>`;
      }).join('')}</ol>`;
      if (max) {
        const full = mine() >= max;
        h += `<p class="kg-pf-build" aria-live="polite">${pend.length ? `<bdi dir="ltr" class="kg-pf-st">${esc(named(pend[0]))} = …</bdi>${btn('data-cancel', esc(host.lab('label-cancel', 'Cancel')))}` : `<span>${esc(host.lab(full ? 'label-full' : 'label-tap', ''))}</span>`}`
          + (pc.corr ? btn(`data-cong${full || corr.length < toks(pc.corr.of).length ? ' disabled' : ''}`, esc(host.lab('label-add-congruence', '+ △ ≅ △'))) : '') + '</p>';
      }
    }
    const fe = document.activeElement as HTMLElement | null;
    const keep = fe && panel.contains(fe) ? [...fe.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}="${a.value}"]`).join('') : '';
    panel.innerHTML = h;
    if (keep) (panel.querySelector<HTMLElement>(keep) ?? panel.querySelector<HTMLElement>('[data-row], button:not([disabled])'))?.focus();
  };
  const changed = () => { dyn.redraw(); render(); host.changed(); };

  const tap = (i: number) => {
    const p = parts[i];
    if (!p || mine() >= max) return;
    // a side equals a side, an angle an angle; tapping the same part twice writes a common side (AC = AC)
    if (pend.length && toks(pend[0]).length !== toks(p).length) pend = [];
    pend.push(p);
    if (pend.length === 2) { rows.push({ s: `${pend[0]} = ${pend[1]}`, r: null }); pend = []; }
    changed();
  };
  const svg = dyn.root.querySelector('svg')!;
  svg.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('[data-part]');
    if (g) tap(Number(g.getAttribute('data-part')));
  });
  svg.addEventListener('keydown', (e) => {
    const g = (e.target as Element).closest('[data-part]');
    if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    tap(Number(g.getAttribute('data-part')));
  });
  panel.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    const d = b.dataset;
    if (d.v !== undefined) corr.push(d.v);
    else if (d.erase !== undefined) corr.pop();
    else if (d.crit) criterion = d.crit;
    else if (d.del) rows.splice(Number(d.del), 1);
    else if (d.cancel !== undefined) pend = [];
    else if (d.cong !== undefined && pc.corr) rows.push({ s: `${pc.corr.of} ≅ ${corr.join(' ')}`, r: null });
    else return;
    changed();
  });
  panel.addEventListener('change', (e) => {
    const s = e.target as HTMLSelectElement, i = Number(s.dataset.row);
    if (!rows[i]) return;
    rows[i].r = s.value || null;
    render();
    host.changed();
  });
  render();
  return {
    root: dyn.root,
    state: (): Partial<ShapeBoardState> => ({ ...dyn.state(), proof: { rows: rows.map((r) => ({ ...r })), criterion, corr: [...corr] } }),
  };
}
