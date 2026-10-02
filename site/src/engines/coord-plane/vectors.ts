// Module `vectors` of <kg-coord-plane>, loaded only by missions whose setup says `module: vectors`. Arrows are drawn
// tail → head on the grid (drag, or tap the tail then the head; on the keyboard Enter at the cursor twice) and read as
// column vectors. Arrows can be slid anywhere (equal vectors), picked from a set of choices, shown with their x and y
// components, and a shape's image can be dragged by a vector (translation). Options: docs/STUDIOS.md; the vector parts
// of the `coord` check: engines/lib/coord-plane-vec.ts.
import type { CoordPlane, CoordPlaneConfig, PlaneModule } from '../coord-plane';
import { samePt, tidy, type P } from '../lib/coord-plane-math';
import { vecOf, type Arrow } from '../lib/coord-plane-vec';

/** An arrow in the setup: tail `from`, then the head `to` or the vector `v`. */
export interface ArrowCfg { from: P; to?: P; v?: P; name?: string; tone?: number; dash?: boolean; move?: boolean }
export interface VectorsConfig {
  /** Fixed arrows (`move: true` = the learner may slide it anywhere; its vector stays and it counts as the learner's). */
  given?: ArrowCfg[];
  /** Arrows to tap and pick (state `picked`). */
  choices?: ArrowCfg[];
  /** The learner's arrows at the start: both ends can be dragged, and the whole arrow slid. */
  start?: ArrowCfg[];
  /** How many arrows the learner may draw (default 1, or 0 with `choices` or `move`); one more replaces the oldest. */
  draw?: number;
  /** Names for the learner's arrows, in order (start arrows first, then drawn ones). */
  names?: string[];
  /** A polygon, its corners lettered with `corners`. */
  shape?: P[];
  corners?: boolean;
  /** The learner drags a copy of the shape (its image; state `shift`). */
  move?: boolean;
  /** A fixed image of the shape, moved by this vector. */
  image?: P;
  /** components (dashed x then y legs with their numbers), readout (the active arrow as a column), shift, trail (corner → image corner). */
  show?: string[];
}

interface Item extends Arrow { name?: string; tone?: number; dash?: boolean; kind: 'fixed' | 'slide' | 'edit' }
type Grab = { k: 'h' | 't' | 'm' | 's' | 'n'; i: number; at: P; orig: Arrow | P };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const HIT = 23;
const cp = (p: P) => [...p] as P;
const toItem = (a: ArrowCfg, kind: Item['kind']): Item =>
  ({ from: cp(a.from), to: a.to ? cp(a.to) : [tidy(a.from[0] + a.v![0]), tidy(a.from[1] + a.v![1])], name: a.name, tone: a.tone, dash: a.dash, kind });
const shiftArrow = (a: Arrow, d: P): Arrow => ({ from: [tidy(a.from[0] + d[0]), tidy(a.from[1] + d[1])], to: [tidy(a.to[0] + d[0]), tidy(a.to[1] + d[1])] });

export function mount(plane: CoordPlane, cfg: CoordPlaneConfig): PlaneModule {
  const c = (cfg.vectors ?? {}) as VectorsConfig, show = c.show ?? [];
  const items: Item[] = [...(c.given ?? []).map((a) => toItem(a, a.move ? 'slide' : 'fixed')), ...(c.start ?? []).map((a) => toItem(a, 'edit'))];
  const choices = (c.choices ?? []).map((a) => toItem(a, 'fixed'));
  const picked = new Set<number>();
  const max = c.draw ?? (c.choices || c.move ? 0 : 1);
  let shift: P = [0, 0], moved = false, active = -1, pending: P | null = null, grab: Grab | null = null, temp: Arrow | null = null;
  const mine = () => items.filter((a) => a.kind !== 'fixed');
  const edits = () => items.filter((a) => a.kind === 'edit');
  const nameOf = (a: Item) => a.name ?? (a.kind === 'edit' ? c.names?.[edits().indexOf(a)] : undefined);
  const { d, lab } = { d: (n: number) => plane.d(n), lab: plane.lab.bind(plane) };
  const sx = (p: P) => plane.sx(p[0]), sy = (p: P) => plane.sy(p[1]);
  const step = () => plane.st;
  const letters = () => lab('letters', 'A B C D E F G H').split(/[\s,،]+/);

  /** A vector as HTML: a column ("{x}\n{y}" square brackets, "({x}\n{y})" round) or a pair ("({x}, {y})"). */
  const colHTML = (v: P) => {
    const f = lab('label-vec', '({x}\n{y})');
    const nums = v.map((n) => plane.numHTML(n));
    if (!f.includes('\n')) return `<bdi dir="ltr">${esc(f).replace('{x}', nums[0]).replace('{y}', nums[1])}</bdi>`;
    return `<span class="vec${f.startsWith('(') ? ' round' : ''}" role="math" aria-label="${esc(`${d(v[0])}, ${d(v[1])}`)}"><span>${nums[0]}</span><span>${nums[1]}</span></span>`;
  };
  const nameSvg = (x: number, y: number, n: string) =>
    `<g class="kg-cp-vname"><text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}">${esc(n)}</text><path d="M${(x - 6).toFixed(1)} ${(y - 10).toFixed(1)}h12m-4 -3l4 3l-4 3"/></g>`;
  const say = (a: Item) => { const v = vecOf(a), n = nameOf(a); return `${n ? `${n}: ` : ''}${d(v[0])}, ${d(v[1])}`; };

  // ---------- drawing ----------
  /** A 44px-wide band along the arrow, so the whole arrow can be grabbed. */
  const band = (a: Arrow, attrs: string) => {
    const [x1, y1, x2, y2] = [sx(a.from), sy(a.from), sx(a.to), sy(a.to)], L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / L) * HIT, ny = ((x2 - x1) / L) * HIT;
    const pts = [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]].map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
    return `<polygon class="kg-cp-vband" points="${pts}" ${attrs}/>`;
  };
  const arrowSvg = (a: Arrow, cls: string, n?: string) => {
    const [x1, y1, x2, y2] = [sx(a.from), sy(a.from), sx(a.to), sy(a.to)], L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = Math.min(16, L * 0.45), bx = x2 - ux * h, by = y2 - uy * h;
    const head = [[x2, y2], [bx - uy * 7, by + ux * 7], [bx + uy * 7, by - ux * 7]].map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
    // the name sits beside the middle, on the arrow's left (screen), clear of the line
    const name = n ? nameSvg((x1 + x2) / 2 + uy * 17, (y1 + y2) / 2 - ux * 17, n) : '';
    return `<g class="kg-cp-vec ${cls}"><line x1="${x1}" y1="${y1}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}"/><polygon points="${head}"/><circle cx="${x1}" cy="${y1}" r="4"/>${name}</g>`;
  };
  const comps = (a: Arrow) => {
    const [dx, dy] = vecOf(a), corner: P = [a.to[0], a.from[1]], o: string[] = [];
    const seg = (p: P, q: P, k: string) => `<line class="kg-cp-${k}" x1="${sx(p)}" y1="${sy(p)}" x2="${sx(q)}" y2="${sy(q)}"/>`;
    const txt = (x: number, y: number, s: string, k: string) => `<text class="kg-cp-num kg-cp-${k}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(s)}</text>`;
    // keep the two numbers off the axis numbers: slide them along their leg, away from the axes (as the step triangle)
    const X = plane.sx(Math.min(Math.max(0, plane.x0), plane.x1)), Y = plane.sy(Math.min(Math.max(0, plane.y0), plane.y1));
    let rx = (sx(a.from) + sx(corner)) / 2, ry = (sy(corner) + sy(a.to)) / 2 + 5;
    if (Math.abs(rx - X) < 18) rx += rx < X ? -16 : 16;
    if (Math.abs(ry - 5 - Y) < 18) ry += ry - 5 < Y ? -14 : 14;
    if (dx) o.push(seg(a.from, corner, 'run'), txt(rx, sy(corner) + (dy > 0 ? 20 : -9), d(dx), 'runl'));
    if (dy) o.push(seg(corner, a.to, 'rise'), txt(sx(corner) + (dx < 0 ? -14 : 14), ry, d(dy), `risel${dx < 0 ? ' end' : ''}`));
    return o.join('');
  };
  const poly = (pts: P[], cls: string, attrs = '') => `<polygon class="${cls}" points="${pts.map((p) => `${sx(p)},${sy(p)}`).join(' ')}" ${attrs}/>`;
  const handle = (p: P, k: 'h' | 't', i: number, label: string) =>
    `<g class="kg-cp-vh${i === active ? ' on' : ''}" data-v${k}="${i}" data-focus="v${k}${i}" tabindex="0" role="button" aria-label="${esc(label)}">` +
    `<circle class="kg-cp-hit" cx="${sx(p)}" cy="${sy(p)}" r="${HIT}"/><circle class="kg-cp-dot" cx="${sx(p)}" cy="${sy(p)}" r="${k === 'h' ? 8 : 6}"/></g>`;

  function draw(o: string[]) {
    const L = letters();
    if (c.shape) {
      const img = (k: P) => c.shape!.map((p) => [tidy(p[0] + k[0]), tidy(p[1] + k[1])] as P);
      o.push(poly(c.shape, 'kg-cp-shape'));
      const off = c.move ? shift : c.image;
      if (off && show.includes('trail') && !samePt(off, [0, 0])) c.shape.forEach((p) => o.push(arrowSvg({ from: p, to: img(off)[c.shape!.indexOf(p)] }, 'trail')));
      if (c.image) o.push(poly(img(c.image), 'kg-cp-shape img'));
      if (c.move) o.push(poly(img(shift), 'kg-cp-shape img move', `data-vs="0" data-focus="vs" tabindex="0" role="button" aria-label="${esc(lab('label-image', 'Image'))} ${esc(`${d(shift[0])}, ${d(shift[1])}`)}"`));
      if (c.corners) {
        // each letter sits outside its corner, away from the shape's centre
        const put = (pts: P[], s: string) => {
          const cx = pts.reduce((t, p) => t + sx(p), 0) / pts.length, cy = pts.reduce((t, p) => t + sy(p), 0) / pts.length;
          pts.forEach((p, i) => {
            const ux = sx(p) - cx, uy = sy(p) - cy, n = Math.hypot(ux, uy) || 1;
            o.push(`<text class="kg-cp-lt" x="${(sx(p) + (ux / n) * 16).toFixed(1)}" y="${(sy(p) + (uy / n) * 16 + 6).toFixed(1)}">${esc(L[i % L.length] + s)}</text>`);
          });
        };
        put(c.shape, '');
        if (c.image || (c.move && moved)) put(img(c.move ? shift : c.image!), '′');
      }
    }
    choices.forEach((a, i) => o.push(arrowSvg(a, `t${a.tone ?? 2}${picked.has(i) ? ' picked' : ''}`, a.name),
      band(a, `data-vc="${i}" data-focus="vc${i}" tabindex="0" role="button" aria-pressed="${picked.has(i)}" aria-label="${esc(say(a))}"`)));
    const all = temp ? [...items, { ...temp, kind: 'edit' } as Item] : items;
    if (show.includes('components')) all.forEach((a) => !samePt(a.from, a.to) && o.push(comps(a)));
    all.forEach((a, i) => !samePt(a.from, a.to) && o.push(arrowSvg(a, `t${a.tone ?? (a.kind === 'edit' ? 'm' : 0)}${a.dash ? ' dash' : ''}${i === active ? ' on' : ''}`, nameOf(a))));
    items.forEach((a, i) => {
      if (a.kind === 'fixed') return;
      const n = nameOf(a) ?? lab('label-arrow', 'Arrow');
      o.push(band(a, `data-vm="${i}" data-focus="vm${i}" tabindex="0" role="button" aria-label="${esc(`${lab('label-slide', 'Slide {name}', { name: n })} (${say(a)})`)}"`));
      if (a.kind === 'edit') o.push(handle(a.from, 't', i, lab('label-tail', 'Tail of {name}', { name: n }) + ` (${d(a.from[0])}, ${d(a.from[1])})`),
        handle(a.to, 'h', i, lab('label-head', 'Head of {name}', { name: n }) + ` (${d(a.to[0])}, ${d(a.to[1])})`));
    });
    if (pending) o.push(`<circle class="kg-cp-pend" cx="${sx(pending)}" cy="${sy(pending)}" r="10"/>`);
  }

  // ---------- editing ----------
  const done = () => plane.changed();
  /** Add a drawn arrow; past `draw`, the oldest drawn one goes. */
  function add(a: Arrow) {
    const e = edits();
    if (e.length >= max) items.splice(items.indexOf(e[0]), 1);
    items.push({ ...a, kind: 'edit' });
    active = items.length - 1;
  }
  /** Move one end (k = 'h'/'t') of arrow i, or slide it ('m'); false if nothing changed or the ends would meet. */
  function set(i: number, k: 'h' | 't' | 'm', a: Arrow) {
    const it = items[i], raw = k === 'm' ? a : k === 'h' ? { from: it.from, to: a.to } : { from: a.from, to: it.to };
    const next = { from: plane.snap(raw.from), to: plane.snap(raw.to) };
    // a slid arrow stays whole on the plane; the ends never meet
    if (k === 'm' && !(samePt(next.from, raw.from) && samePt(next.to, raw.to))) return false;
    if (samePt(next.from, next.to) || (samePt(next.from, it.from) && samePt(next.to, it.to))) return false;
    Object.assign(it, next);
    active = i;
    done();
    return true;
  }
  const moveShift = (p: P) => {
    if (samePt(p, shift)) return;
    // keep the whole image on the plane
    if (!c.shape!.every((q) => samePt(plane.snap([q[0] + p[0], q[1] + p[1]]), [tidy(q[0] + p[0]), tidy(q[1] + p[1])]))) return;
    shift = p;
    moved = true;
    done();
  };
  const toggle = (i: number) => { if (picked.has(i)) picked.delete(i); else picked.add(i); done(); };

  function down(q: P, e: PointerEvent): boolean {
    const t = (e.target as Element).closest('[data-vh],[data-vt],[data-vm],[data-vc],[data-vs]'), p = plane.snap(q);
    temp = null;
    if (t) {
      const k = (['vh', 'vt', 'vm', 'vc', 'vs'] as const).find((x) => t.hasAttribute(`data-${x}`))!, i = Number(t.getAttribute(`data-${k}`));
      if (k === 'vc') { toggle(i); grab = null; return true; }
      grab = { k: k[1] as Grab['k'], i, at: p, orig: k === 'vs' ? cp(shift) : { from: cp(items[i].from), to: cp(items[i].to) } };
      if (k !== 'vs') { active = i; plane.render(); }
      return true;
    }
    if (!max) return false;
    if (pending && !samePt(pending, p)) {
      add({ from: pending, to: p });
      pending = null;
      grab = null;
      done();
      return true;
    }
    grab = { k: 'n', i: -1, at: p, orig: p };
    temp = { from: p, to: p };
    return true;
  }
  function move(q: P) {
    if (!grab) return;
    const p = plane.snap(q), dl: P = [tidy(p[0] - grab.at[0]), tidy(p[1] - grab.at[1])];
    if (grab.k === 'n') { if (!samePt(temp!.to, p)) { temp!.to = p; plane.render(); } return; }
    if (grab.k === 's') return moveShift([tidy((grab.orig as P)[0] + dl[0]), tidy((grab.orig as P)[1] + dl[1])]);
    const o = grab.orig as Arrow;
    set(grab.i, grab.k as 'h' | 't' | 'm', grab.k === 'm' ? shiftArrow(o, dl) : { from: p, to: p });
  }
  function up() {
    if (grab?.k === 'n' && temp) {
      if (samePt(temp.from, temp.to)) pending = temp.from; // a tap: the tail; the next tap sets the head
      else { add(temp); pending = null; }
      temp = null;
      done();
    }
    grab = null;
  }

  function key(e: KeyboardEvent, cursor: P): boolean {
    const t = e.target as Element, k = e.key, [a, b] = step();
    const dir: Record<string, P> = { ArrowRight: [a, 0], ArrowLeft: [-a, 0], ArrowUp: [0, b], ArrowDown: [0, -b] };
    const it = t.closest('[data-vh],[data-vt],[data-vm],[data-vc],[data-vs]');
    if (it) {
      const kind = (['vh', 'vt', 'vm', 'vc', 'vs'] as const).find((x) => it.hasAttribute(`data-${x}`))!, i = Number(it.getAttribute(`data-${kind}`));
      if (kind === 'vc') {
        if (k !== 'Enter' && k !== ' ') return false;
        e.preventDefault();
        toggle(i);
        return true;
      }
      if (dir[k]) {
        e.preventDefault();
        // Right/Up always mean bigger: the plane runs left → right even on RTL pages
        if (kind === 'vs') moveShift([tidy(shift[0] + dir[k][0]), tidy(shift[1] + dir[k][1])]);
        else set(i, kind[1] as 'h' | 't' | 'm', shiftArrow(items[i], dir[k]));
        return true;
      }
      if ((k === 'Delete' || k === 'Backspace') && kind !== 'vs' && items[i].kind === 'edit') {
        e.preventDefault();
        items.splice(i, 1);
        active = -1;
        done();
        plane.querySelector('svg')?.focus();
        return true;
      }
      return false;
    }
    if (t.tagName !== 'svg' || !max) return false;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (pending && !samePt(pending, cursor)) { add({ from: pending, to: cursor }); pending = null; }
      else pending = pending ? null : cp(cursor);
      done();
      return true;
    }
    if (k === 'Escape' && pending) { pending = null; plane.render(); return true; }
    if ((k === 'Backspace' || k === 'Delete') && edits().length) {
      e.preventDefault();
      items.splice(items.lastIndexOf(edits().at(-1)!), 1);
      active = -1;
      done();
      return true;
    }
    return false;
  }

  const self: PlaneModule = {
    draw, down, move, up, key,
    tools: () => (max ? `<button type="button" class="secondary kg-cp-btn" data-act="vclear">${esc(lab('label-clear-arrows', 'Clear arrows'))}</button>` : ''),
    state: () => ({
      vectors: mine().map((a) => ({ from: cp(a.from), to: cp(a.to) })),
      ...(choices.length ? { choices: choices.map((a) => ({ from: cp(a.from), to: cp(a.to) })), picked: [...picked].sort((x, y) => x - y) } : {}),
      ...(c.move ? { shift: moved ? cp(shift) : null } : {}),
    }),
    facts: () => {
      const f: string[] = [], a = items[active] ?? mine().at(-1);
      if (show.includes('readout') && a && a.kind !== 'fixed') {
        const n = nameOf(a);
        // a named vector reads left to right in every locale: AB = (5, 3)
        f.push(n ? `<bdi dir="ltr" class="kg-cp-vr"><span class="kg-cp-vn">${esc(n)}</span> = ${colHTML(vecOf(a))}</bdi>` : `${esc(lab('label-arrow', 'Arrow'))} ${colHTML(vecOf(a))}`);
      }
      if (show.includes('shift') && c.move) f.push(`${esc(lab('label-shift', ''))} ${colHTML(shift)}`);
      return f;
    },
    live: (cur: P) => {
      const a = items[active];
      if (plane.querySelector('svg')?.matches(':focus')) return `${pending ? `${lab('label-from', 'From')} ${d(pending[0])}, ${d(pending[1])}; ` : ''}${d(cur[0])}, ${d(cur[1])}`;
      return a && a.kind !== 'fixed' ? say(a) : '';
    },
  };
  plane.addEventListener('click', (e) => {
    if (plane.mod !== self || !(e.target as Element).closest('[data-act="vclear"]')) return;
    items.splice(0, items.length, ...items.filter((x) => x.kind !== 'edit'));
    pending = null;
    active = -1;
    done();
  });
  return self;
}
