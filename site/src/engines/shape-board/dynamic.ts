// Dynamic geometry for <kg-shape-board>, loaded only by missions whose setup has `dynamic`: a figure of named points
// the learner drags (free, or gliding on a line or circle) while built points, lines, circles and angle marks stay
// attached, with live readouts (`watch`: angles, lengths, sums, ratios, products, sin/cos/tan) and an optional
// "what stayed the same?" choice (`ask`) and lock toggle (`lock`). Figure logic: ../lib/shape-board-dynamic.ts.
import type { ShapeBoard, ShapeBoardConfig } from '../shape-board';
import type { ShapeBoardState } from '../lib/shape-board-check';
import { dpOf, Figure, readings, toks, type CircleSpec, type DynamicConfig, type LineSpec, type Names, type Pts } from '../lib/shape-board-dynamic';
import { parallel, type P, type Seg } from '../lib/shape-board-geom';

const U = 44;
type Item = { seg?: Names; line?: LineSpec; ray?: Names; poly?: Names; circle?: CircleSpec; angle?: string; tone?: number; dash?: boolean; arrows?: number; ticks?: number; text?: string; watch?: string; right?: boolean };

export function mountDynamic(host: ShapeBoard, cfg: ShapeBoardConfig) {
  const dc = cfg.dynamic as DynamicConfig, f = new Figure(dc);
  const x0 = cfg.x?.[0] ?? 0, x1 = cfg.x?.[1] ?? 6, y0 = cfg.y?.[0] ?? 0, y1 = cfg.y?.[1] ?? 6, step = cfg.step ?? 1;
  const M = cfg.axes ? 32 : 22, W = (x1 - x0) * U + 2 * M, H = (y1 - y0) * U + 2 * M;
  const sx = (x: number) => +(M + (x - x0) * U).toFixed(1), sy = (y: number) => +(M + (y1 - y) * U).toFixed(1);
  const xy = (p: P) => `${sx(p[0])},${sy(p[1])}`;
  const name = (n: string) => host.lab(`name-${n}`, n);
  const drag = new Set(dc.drag ?? []);
  const root = document.createElement('div'), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), info = document.createElement('div');
  root.className = 'kg-sb-dyn';
  svg.setAttribute('class', 'kg-sb-svg kg-sb-dsvg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', host.lab('label-board', 'Board'));
  svg.style.maxInlineSize = `${Math.round(W * 1.6)}px`;
  root.append(svg, info);
  let pts: Pts = f.solve(), chosen: string | null = null, grab: { n: string; moved: boolean } | null = null;
  const seen = new Set([f.snapshot()]);
  const draggable = (n: string) => drag.has(n) || !!f.free[n];
  const shown = (n: string) => !f.def(n).hide || draggable(n);

  /** Keep a move only if the figure can still be built and every point shown stays on the board. */
  const tryMove = (n: string, act: () => void) => {
    const before = f.snapshot();
    act();
    const next = f.solve(), ok = Object.entries(next).every(([k, p]) => !shown(k) || (p ? p[0] >= x0 - 1e-6 && p[0] <= x1 + 1e-6 && p[1] >= y0 - 1e-6 && p[1] <= y1 + 1e-6 : !!f.def(k).maybe));
    if (!ok) { f.restore(before); pts = f.solve(); return false; }
    pts = next;
    return f.snapshot() !== before;
  };
  const settle = () => { seen.add(f.snapshot()); draw(); host.changed(); };

  // ---------- drawing ----------
  const clip = (a: P, b: P, ray: boolean): Seg => {
    const d: P = [b[0] - a[0], b[1] - a[1]];
    let lo = ray ? 0 : -1e9, hi = 1e9;
    ([[0, x0, x1], [1, y0, y1]] as const).forEach(([k, mn, mx]) => {
      if (Math.abs(d[k]) < 1e-12) return;
      const t1 = (mn - a[k]) / d[k], t2 = (mx - a[k]) / d[k];
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    });
    return [[a[0] + lo * d[0], a[1] + lo * d[1]], [a[0] + hi * d[0], a[1] + hi * d[1]]];
  };
  const ln = ([a, b]: Seg, cls: string) => `<line class="${cls}" x1="${sx(a[0])}" y1="${sy(a[1])}" x2="${sx(b[0])}" y2="${sy(b[1])}"/>`;
  const txt = (p: P, cls: string, s: string, dx = 0, dy = 0) => `<text class="${cls}" x="${(sx(p[0]) + dx).toFixed(1)}" y="${(sy(p[1]) + dy + 5).toFixed(1)}">${s}</text>`;
  /** n marks across the middle of a: chevrons along it (parallel) or ticks across it (equal lengths). */
  const marks = ([a, b]: Seg, n: number, chevron: boolean, cls: string) => {
    const ax = sx(a[0]), ay = sy(a[1]), dx = sx(b[0]) - ax, dy = sy(b[1]) - ay, l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
    let o = '';
    for (let i = 0; i < n; i++) {
      const c = [ax + dx / 2 + u[0] * (i - (n - 1) / 2) * 8, ay + dy / 2 + u[1] * (i - (n - 1) / 2) * 8];
      const at = (s: number, t: number) => `${(c[0] + u[0] * s - u[1] * t).toFixed(1)},${(c[1] + u[1] * s + u[0] * t).toFixed(1)}`;
      o += `<polyline class="${cls}" points="${chevron ? `${at(-4, -6)} ${at(3, 0)} ${at(-4, 6)}` : `${at(0, -7)} ${at(0, 7)}`}"/>`;
    }
    return o;
  };
  const value = (k: string, v: number | null) => {
    const w = dc.watch?.find((x) => x.key === k);
    return v === null || !w ? "—" : host.d(v.toFixed(dpOf(w)));
  };

  const draw = () => {
    const vals = readings(dc.watch, pts), o: string[] = [`<rect class="kg-sb-bg" width="${W}" height="${H}"/>`];
    const grid = cfg.grid ?? 'dots';
    for (let x = Math.ceil(x0); x <= x1; x++)
      for (let y = Math.ceil(y0); y <= y1; y++) {
        if (grid === 'lines' && x === Math.ceil(x0)) o.push(ln([[x0, y], [x1, y]], 'kg-sb-grid'));
        if (grid === 'lines' && y === Math.ceil(y0)) o.push(ln([[x, y0], [x, y1]], 'kg-sb-grid'));
        if (grid !== 'none') o.push(`<circle class="kg-sb-dot" cx="${sx(x)}" cy="${sy(y)}" r="${grid === 'dots' ? 4 : 2.5}"/>`);
      }
    // lines carrying `arrows` get their chevrons only while they really are parallel to another such line
    const items = (dc.draw ?? []) as Item[], arrowed: Seg[] = [];
    const segOf = (it: Item): Seg | null => {
      if (it.line !== undefined) return f.line(it.line);
      const [a, b] = toks((it.seg ?? it.ray)!).map((n) => pts[n]);
      return a && b ? [a, b] : null;
    };
    items.forEach((it) => { const s = it.arrows ? segOf(it) : null; if (s) arrowed.push(s); });
    for (const it of items) {
      const hidden = it.watch && dc.watch?.find((w) => w.key === it.watch)?.show === false;
      const cls = `kg-sb-g t${it.tone ?? 2}${it.dash ? ' dash' : ''}`;
      if (it.poly) {
        const ps = toks(it.poly).map((n) => pts[n]);
        if (ps.every(Boolean)) o.push(`<polygon class="${cls} closed" points="${(ps as P[]).map(xy).join(' ')}"/>`);
      } else if (it.circle) {
        const c = f.circle(it.circle);
        if (c) o.push(`<circle class="${cls}" cx="${sx(c[0])}" cy="${sy(c[1])}" r="${(c[2] * U).toFixed(1)}"/>`);
      } else if (it.angle) {
        const [a, v, b] = toks(it.angle).map((n) => pts[n]);
        if (!a || !v || !b) continue;
        const ang = (p: P) => Math.atan2(sy(p[1]) - sy(v[1]), sx(p[0]) - sx(v[0]));
        let t0 = ang(a), t1 = ang(b), d = t1 - t0;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const r = 24, cx = sx(v[0]), cy = sy(v[1]), at = (t: number, rr: number) => `${(cx + rr * Math.cos(t)).toFixed(1)},${(cy + rr * Math.sin(t)).toFixed(1)}`;
        const mid = t0 + d / 2;
        o.push(it.right
          ? `<polygon class="kg-sb-arc t${it.tone ?? 2}" points="${cx},${cy} ${at(t0, 16)} ${at(mid, 16 * Math.SQRT2)} ${at(t1, 16)}"/>`
          : `<path class="kg-sb-arc t${it.tone ?? 2}" d="M${cx},${cy}L${at(t0, r)}A${r},${r} 0 0 ${d > 0 ? 1 : 0} ${at(t1, r)}Z"/>`);
        const label = hidden ? '?' : it.watch ? `${value(it.watch, vals[it.watch])}°` : it.text ? host.d(it.text) : '';
        if (label) { const [lx, ly] = at(mid, it.watch ? 44 : 36).split(',').map(Number); o.push(`<text class="kg-sb-ang" x="${lx}" y="${ly + 5}">${label}</text>`); }
      } else {
        const s = segOf(it);
        if (!s) continue;
        const seen2 = it.seg ? s : clip(s[0], s[1], !!it.ray);
        o.push(ln(seen2, cls));
        if (it.arrows && arrowed.filter((t) => parallel(t, s)).length > 1) o.push(marks(seen2, it.arrows, true, `kg-sb-mk t${it.tone ?? 2}`));
        if (it.ticks) o.push(marks(seen2, it.ticks, false, `kg-sb-mk t${it.tone ?? 2}`));
      }
    }
    // letters away from the middle of the figure
    const vis = Object.keys(pts).filter((n) => pts[n] && shown(n)), ps = vis.map((n) => pts[n]!);
    const c: P = [ps.reduce((s, p) => s + p[0], 0) / (ps.length || 1), ps.reduce((s, p) => s + p[1], 0) / (ps.length || 1)];
    for (const n of vis) {
      const p = pts[n]!, d = f.def(n), off = d.off ?? (() => { const v = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(v[0], v[1]) || 1; return [(v[0] / l) * 0.42, (v[1] / l) * 0.42] as P; })();
      const letter = d.hide ? '' : txt([p[0] + off[0], p[1] + off[1]], 'kg-sb-lt', host.lab(`name-${n}`, n).replace(/[&<>"]/g, ''));
      if (draggable(n))
        o.push(`<g class="kg-sb-handle${grab?.n === n ? ' on' : ''}" data-p="${n}" tabindex="0" role="button" aria-label="${host.lab('label-handle', '{p}', { p: name(n) })}"><circle class="kg-sb-hh" cx="${sx(p[0])}" cy="${sy(p[1])}" r="26"/><circle class="kg-sb-h${d.hide ? ' ring' : ''}" cx="${sx(p[0])}" cy="${sy(p[1])}" r="10"/></g>${letter}`);
      else o.push(`<circle class="kg-sb-gv" cx="${sx(p[0])}" cy="${sy(p[1])}" r="5"/>${letter}`);
    }
    const focus = (document.activeElement as Element | null)?.getAttribute?.('data-p');
    svg.innerHTML = o.join('');
    if (focus) svg.querySelector<SVGElement>(`[data-p="${focus}"]`)?.focus();

    // readouts, the choice and the lock
    const chip = (k: string, tone = 2) => `<span class="kg-sb-w t${tone}"><bdi dir="ltr">${host.lab(`watch-${k}`, `${k} = {v}`, { v: value(k, vals[k]) })}</bdi></span>`;
    let html = (dc.watch ?? []).filter((w) => w.show === undefined || w.show === true).map((w) => chip(w.key, w.tone)).join('');
    html = html ? `<p class="kg-sb-watch" aria-live="polite">${html}</p>` : '';
    if (dc.ask) html += `<div class="kg-sb-ask" role="radiogroup" aria-label="${host.lab('label-ask', '')}">${dc.ask.map((k) => `<button type="button" role="radio" class="kg-sb-tile" data-ask="${k}" aria-checked="${chosen === k}">${host.lab(`ask-${k}`, k)}</button>`).join('')}</div>`;
    if (dc.lock?.length) html += `<button type="button" class="secondary kg-sb-btn" data-lock aria-pressed="${f.locked}">${host.lab('label-lock', 'Lock')}</button>`;
    const fa = document.activeElement as HTMLElement | null, keep = fa && info.contains(fa) ? (fa.dataset.ask ? `[data-ask="${fa.dataset.ask}"]` : '[data-lock]') : '';
    if (info.innerHTML !== html) info.innerHTML = html;
    if (keep) info.querySelector<HTMLElement>(keep)?.focus();
  };

  // ---------- input ----------
  const toBoard = (e: PointerEvent): P => {
    const r = svg.getBoundingClientRect();
    return [x0 + ((e.clientX - r.left) * W) / (r.width || 1) / U - M / U, y1 - (((e.clientY - r.top) * H) / (r.height || 1) - M) / U];
  };
  svg.addEventListener('pointerdown', (e) => {
    const n = (e.target as Element).closest('[data-p]')?.getAttribute('data-p');
    if (!n) return;
    e.preventDefault();
    grab = { n, moved: false };
    svg.setPointerCapture?.(e.pointerId);
    draw();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!grab) return;
    const n = grab.n;
    if (tryMove(n, () => f.moveTo(n, toBoard(e), step))) { grab.moved = true; draw(); }
  });
  const up = () => {
    if (!grab) return;
    const moved = grab.moved;
    grab = null;
    if (moved) settle();
    else draw();
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('keydown', (e) => {
    const n = (e.target as Element).closest('[data-p]')?.getAttribute('data-p');
    const d = ({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, [number, number]>)[e.key];
    if (!n || !d) return;
    e.preventDefault();
    if (tryMove(n, () => f.nudge(n, d[0], d[1], step))) settle();
  });
  info.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.ask) chosen = b.dataset.ask;
    else {
      f.setLocked(!f.locked);
      tryMove('', () => {});
    }
    settle();
  });
  draw();
  const round = (p: P | null) => p && (p.map((v) => Math.round(v * 1000) / 1000) as P);
  return {
    root,
    redraw: draw,
    state: (): Partial<ShapeBoardState> => ({
      dyn: { pts: Object.fromEntries(Object.entries(pts).map(([k, p]) => [k, round(p)])), values: readings(dc.watch, pts), dragged: seen.size - 1, chosen, locked: f.locked },
    }),
  };
}
