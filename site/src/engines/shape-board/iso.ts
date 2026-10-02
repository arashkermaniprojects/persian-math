// 3D views for <kg-shape-board>, loaded only by missions that use them:
//   cubes   unit cubes on isometric dot paper, with a plan grid: tap a square to stack one more cube there
//           (volume by counting, layer by layer); or a fixed cuboid `box` to count.
//   solids  pictures of solid shapes to recognise and tap (cube, cuboid, prism, pyramid, cylinder, cone, sphere).
import type { ShapeBoard } from '../shape-board';
import type { ShapeBoardState } from '../lib/shape-board-check';

export interface CubesConfig {
  /** Plan size [columns, rows] (default 3 × 3). */
  size?: [number, number];
  /** Cubes stacked on each plan square, rows of columns (row 0 at the back). */
  heights?: number[][];
  /** Shortcut for a full cuboid [length, width, height]. */
  box?: [number, number, number];
  /** Tap the plan to add cubes (wraps back to 0 after `max`, default 4). */
  edit?: boolean;
  max?: number;
}
export interface Solid { kind: 'cube' | 'cuboid' | 'prism' | 'pyramid' | 'cylinder' | 'cone' | 'sphere'; tone?: number; name?: string }

const S = 30, CX = 0.866 * S, CY = 0.5 * S;

/** Box shape [length, width, height] when the stacks make one full cuboid, else null. */
export function boxOf(h: number[][]): [number, number, number] | null {
  const cells = h.flatMap((row, r) => row.map((v, c) => [r, c, v])).filter((x) => x[2] > 0);
  if (!cells.length) return null;
  const rs = cells.map((x) => x[0]), cs = cells.map((x) => x[1]), w = Math.max(...rs) - Math.min(...rs) + 1, l = Math.max(...cs) - Math.min(...cs) + 1;
  return cells.length === w * l && cells.every((x) => x[2] === cells[0][2]) ? [l, w, cells[0][2]] : null;
}

export function mountIso(host: ShapeBoard, cfg: { cubes?: unknown; solids?: unknown; mode?: string }) {
  const root = document.createElement('div');
  root.className = 'kg-sb-iso';
  root.dir = 'ltr';
  if (cfg.solids) return solids(host, root, cfg.solids as Solid[], cfg.mode === 'select');
  const c = cfg.cubes as CubesConfig;
  const [cols, rows] = c.box ? [c.box[0], c.box[1]] : c.size ?? [c.heights?.[0]?.length ?? 3, c.heights?.length ?? 3];
  const h: number[][] = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, i) => (c.box ? c.box[2] : c.heights?.[r]?.[i] ?? 0)));
  const max = c.max ?? 4;
  const draw = () => {
    const top = Math.max(max, ...h.flat()) * S;
    const pt = (i: number, j: number, k: number) => `${((i - j) * CX).toFixed(1)},${((i + j) * CY - k * S).toFixed(1)}`;
    const o: string[] = [];
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) o.push(`<circle class="kg-sb-dot" r="2.5" cx="${((i - j) * CX).toFixed(1)}" cy="${((i + j) * CY).toFixed(1)}"/>`);
    const cubes: [number, number, number][] = [];
    h.forEach((row, j) => row.forEach((v, i) => { for (let k = 0; k < v; k++) cubes.push([i, j, k]); }));
    cubes.sort((a, b) => a[0] + a[1] - b[0] - b[1] || a[2] - b[2]);
    for (const [i, j, k] of cubes) {
      const f = (cls: string, q: [number, number, number][]) => o.push(`<polygon class="kg-sb-cube ${cls}" points="${q.map((x) => pt(...x)).join(' ')}"/>`);
      f('top', [[i, j, k + 1], [i + 1, j, k + 1], [i + 1, j + 1, k + 1], [i, j + 1, k + 1]]);
      f('right', [[i + 1, j, k], [i + 1, j + 1, k], [i + 1, j + 1, k + 1], [i + 1, j, k + 1]]);
      f('left', [[i, j + 1, k], [i + 1, j + 1, k], [i + 1, j + 1, k + 1], [i, j + 1, k + 1]]);
    }
    const x0 = -rows * CX - 6, w = (cols + rows) * CX + 12, y0 = -top - 6, hh = (cols + rows) * CY + top + 12;
    let html = `<svg class="kg-sb-3d" viewBox="${x0.toFixed(1)} ${y0} ${w.toFixed(1)} ${hh.toFixed(1)}" role="img" aria-label="${host.lab('label-cubes', '{n}', { n: host.d(cubes.length) })}">${o.join('')}</svg>`;
    if (c.edit) {
      let plan = '';
      h.forEach((row, j) => row.forEach((v, i) => (plan += `<button type="button" class="kg-sb-plan-c" data-c="${j}-${i}" aria-label="${host.lab('label-stack', '{n}', { n: host.d(v) })}">${v ? host.d(v) : ''}</button>`)));
      html += `<div class="kg-sb-plan" style="--cols:${cols}" role="group" aria-label="${host.lab('label-plan', 'Plan')}">${plan}</div>`;
    }
    root.innerHTML = html;
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-c]');
    if (!b) return;
    const [j, i] = b.dataset.c!.split('-').map(Number);
    h[j][i] = (h[j][i] + 1) % (max + 1);
    draw();
    host.changed();
    root.querySelector<HTMLElement>(`[data-c="${b.dataset.c}"]`)?.focus();
  });
  draw();
  return {
    root,
    state: (): Partial<ShapeBoardState> => ({ cubes: { count: h.flat().reduce((s, v) => s + v, 0), heights: h.map((r) => [...r]), box: boxOf(h) } }),
  };
}

/** Line drawings in a 100 × 100 box; hidden edges dashed. */
const PICS: Record<Solid['kind'], string> = {
  cube: 'M30 38L56 25L82 38L82 72L56 85L30 72Z|M30 38L56 51L82 38M56 51L56 85|',
  cuboid: 'M12 42L34 31L90 45L90 70L68 81L12 67Z|M12 42L68 56L90 45M68 56L68 81|',
  prism: 'M15 75L35 40L55 75Z|M35 40L75 25L95 60L55 75M95 60|M15 75L75 60L95 60M75 60L75 25',
  pyramid: 'M15 72L60 82L85 66L50 15Z|M50 15L60 82|M15 72L40 58L85 66M40 58L50 15',
  cylinder: 'M25 25A25 9 0 0 0 75 25A25 9 0 0 0 25 25M25 25L25 78A25 9 0 0 0 75 78L75 25Z|M25 25A25 9 0 0 0 75 25|M25 78A25 9 0 0 1 75 78',
  cone: 'M50 12L25 76A25 9 0 0 0 75 76Z|M50 12L50 12|M25 76A25 9 0 0 1 75 76',
  sphere: 'M50 15A35 35 0 1 0 50 85A35 35 0 1 0 50 15Z|M15 50A35 11 0 0 0 85 50|M15 50A35 11 0 0 1 85 50',
};

function solids(host: ShapeBoard, root: HTMLElement, list: Solid[], select: boolean) {
  const sel = new Set<number>();
  const draw = () => {
    root.innerHTML = `<div class="kg-sb-solids">${list
      .map((s, i) => {
        const [body, front, back] = PICS[s.kind].split('|');
        const pic = `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="kg-sb-g t${s.tone ?? i % 6} closed" d="${body}"/><path class="kg-sb-edge" d="${front}"/><path class="kg-sb-edge dash" d="${back}"/></svg>`;
        const name = host.lab(`label-${s.name ?? s.kind}`, s.name ?? s.kind);
        return select
          ? `<button type="button" class="kg-sb-solid" data-s="${i}" aria-pressed="${sel.has(i)}" aria-label="${name}">${pic}</button>`
          : `<figure class="kg-sb-solid" role="img" aria-label="${name}">${pic}</figure>`;
      })
      .join('')}</div>`;
  };
  root.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-s]');
    if (!b) return;
    const i = Number(b.dataset.s);
    if (!sel.delete(i)) sel.add(i);
    draw();
    host.changed();
    root.querySelector<HTMLElement>(`[data-s="${i}"]`)?.focus();
  });
  draw();
  return { root, state: (): Partial<ShapeBoardState> => ({ selected: [...sel].sort((a, b) => a - b) }) };
}
