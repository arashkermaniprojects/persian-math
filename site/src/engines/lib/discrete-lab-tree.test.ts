import { describe, expect, it } from 'vitest';
import {
  allPaths, altProb, asked, checkTree, children, exhausted, fadd, feq, fmul, layoutTree, leavesOf, options, pathProd, pathSum, prob,
  stageSum, type TreeConfig, type TreeState,
} from './discrete-lab-tree';
import { checkSets } from './discrete-lab-check';
import { evaluate } from '../../lib/checks';

const outfits: TreeConfig = { stages: [{ outcomes: ['red', 'blue', 'green'] }, { outcomes: ['black', 'grey'] }] };
const bag: TreeConfig = { bag: { r: 3, b: 2 }, draws: 2 };
const noBack: TreeConfig = { ...bag, replace: false };
const roles: TreeConfig = { bag: { ali: 1, sara: 1, maryam: 1 }, draws: 2, replace: false };

describe('fractions', () => {
  it('multiplies and adds without simplifying, and compares equivalent fractions', () => {
    expect(fmul([2, 6], [2, 6])).toEqual([4, 36]);
    expect(fadd([1, 4], [1, 4])).toEqual([2, 4]);
    expect(fadd([1, 2], [1, 3])).toEqual([5, 6]);
    expect(feq([2, 4], [1, 2])).toBe(true);
    expect(feq([1, 0], [1, 0])).toBe(false);
    expect(feq(null, [1, 2])).toBe(false);
  });
});

describe('the true tree', () => {
  it('grows every outcome of each stage (the product rule)', () => {
    expect(children(outfits, '')).toEqual(['red', 'blue', 'green']);
    expect(children(outfits, 'red')).toEqual(['black', 'grey']);
    expect(children(outfits, 'red.black')).toEqual([]);
    expect(leavesOf(outfits)).toHaveLength(6);
    expect(allPaths(outfits).slice(0, 4)).toEqual(['', 'red', 'red.black', 'red.grey']);
    expect(stageSum(outfits)).toBe(5);
  });
  it('without replacement, an item that has run out has no branch', () => {
    expect(children(roles, 'ali')).toEqual(['sara', 'maryam']);
    expect(exhausted(roles, 'ali')).toEqual(['ali']);
    expect(options(roles, 1)).toEqual(['ali', 'sara', 'maryam']);
    expect(leavesOf(roles)).toHaveLength(6);
    expect(stageSum(roles)).toBe(5);
    expect(exhausted(bag, 'r')).toEqual([]);
  });
  it('works out the probabilities of a bag, with and without replacement', () => {
    expect(prob(bag, 'r')).toEqual([3, 5]);
    expect(prob(bag, 'r.r')).toEqual([3, 5]);
    expect(prob(noBack, 'r.r')).toEqual([2, 4]);
    expect(prob(noBack, 'b.b')).toEqual([1, 4]);
    expect(altProb(noBack, 'r.r')).toEqual([3, 5]);
    expect(altProb(bag, 'r.r')).toBeNull();
    expect(pathProd('r.r', (p) => prob(noBack, p))).toEqual([6, 20]);
    expect(pathSum('r.r', (p) => prob(noBack, p))).toEqual([22, 20]);
  });
  it('uses stage probabilities and per-path overrides (dependent events)', () => {
    const coin: TreeConfig = { stages: [{ outcomes: ['h', 't'], p: [[1, 2], [1, 2]] }, { outcomes: ['h', 't'], p: [[1, 2], [1, 2]] }] };
    expect(prob(coin, 't.h')).toEqual([1, 2]);
    expect(prob(outfits, 'red')).toBeNull();
    const rain: TreeConfig = { stages: [{ outcomes: ['rain', 'dry'], p: [[1, 3], [2, 3]] }, { outcomes: ['late', 'on'] }], p: { 'rain.late': [1, 4], 'rain.on': [3, 4], 'dry.late': [1, 10], 'dry.on': [9, 10] } };
    expect(pathProd('rain.late', (p) => prob(rain, p))).toEqual([1, 12]);
  });
  it('names the asked paths by path or by stage', () => {
    const ps = allPaths(noBack).filter(Boolean);
    expect(asked('all', ps)).toHaveLength(6);
    expect(asked([2], ps)).toEqual(['r.r', 'r.b', 'b.r', 'b.b']);
    expect(asked(['r', 'b.b'], ps)).toEqual(['r', 'b.b']);
    expect(asked(undefined, ps)).toEqual([]);
  });
});

describe('layout', () => {
  it('puts leaves in rows and each node between its branches, left to right', () => {
    const L = layoutTree((p) => children(outfits, p), 2, { gap: 56, reserve: 100 });
    expect(L.xs).toEqual([26, 143, 260]);
    expect(L.pos['red.black']).toEqual([260, 36]);
    expect(L.pos['red']).toEqual([143, 64]);
    expect(L.pos['']).toEqual([26, 36 + 56 * 2.5]);
    expect(L.h).toBe(72 + 56 * 5);
  });
  it('an ungrown tree is just the root', () => {
    const L = layoutTree(() => [], 2, { gap: 56, reserve: 100 });
    expect(Object.keys(L.pos)).toEqual(['']);
    expect(L.h).toBe(120);
  });
});

const base = (o: Partial<TreeState> = {}): TreeState => ({ leaves: 0, sum: 5, nodes: [], p: {}, product: {}, count: {}, picked: [], ...o });

describe('checkTree', () => {
  it('grown: every node has exactly its branches; an item not put back is named', () => {
    const node = (path: string, got: string[]) => ({ path, got, truth: children(roles, path), gone: exhausted(roles, path) });
    const all = [node('', ['ali', 'sara', 'maryam']), node('ali', ['sara', 'maryam']), node('sara', ['ali', 'maryam']), node('maryam', ['ali', 'sara'])];
    expect(checkTree({ grown: true }, base({ nodes: all }))).toBeNull();
    expect(checkTree({ grown: true }, base({ nodes: [...all.slice(0, 3), node('maryam', [])] }))?.code).toBe('not-grown');
    expect(checkTree({ grown: true }, base({ nodes: [...all.slice(0, 3), node('maryam', ['ali', 'sara', 'maryam'])] }))?.code).toBe('replacement-ignored');
    expect(checkTree({ grown: true }, base({ nodes: [...all.slice(0, 3), node('maryam', ['ali'])] }))?.code).toBe('branch-missing');
    expect(checkTree({ grown: true }, base({ nodes: [{ path: '', got: ['a', 'x'], truth: ['a'], gone: [] }] }))?.code).toBe('branch-extra');
    expect(checkTree({ grown: true }, undefined)?.code).toBe('not-grown');
  });

  const pState = (got: Record<string, [number, number] | null>, c = noBack): TreeState =>
    base({ p: Object.fromEntries(allPaths(c).filter(Boolean).map((k) => [k, { ask: k in got, got: got[k] ?? null, truth: prob(c, k)!, alt: altProb(c, k) }])) });
  it('branches: empty, replacement ignored, not adding up to one, wrong, and traps', () => {
    const right = { 'r.r': [2, 4], 'r.b': [1, 2], 'b.r': [3, 4], 'b.b': [1, 4] } as Record<string, [number, number]>;
    expect(checkTree({ branches: true }, pState(right))).toBeNull();
    expect(checkTree({ branches: true }, pState({ ...right, 'b.b': null }))?.code).toBe('branch-empty');
    expect(checkTree({ branches: true }, base())?.code).toBe('branch-empty');
    expect(checkTree({ branches: true }, pState({ ...right, 'r.r': [3, 5], 'r.b': [2, 5] }))?.code).toBe('replacement-ignored');
    expect(checkTree({ branches: true }, pState({ ...right, 'b.b': [2, 4] }))?.code).toBe('branches-not-one');
    expect(checkTree({ branches: true }, pState({ ...right, 'b.r': [1, 4], 'b.b': [3, 4] }))?.code).toBe('branch-wrong');
    expect(checkTree({ branches: true }, pState({ ...right, 'b.r': [1, 4], 'b.b': [3, 4] }), [{ branch: 'b.b', value: [3, 4], code: 'swapped' }])?.code).toBe('swapped');
  });
  it('products: added along the branch, replacement ignored, wrong', () => {
    const st = (got: [number, number]) => base({ product: { 'r.r': { got, truth: [6, 20], add: [22, 20], alt: [9, 25] } } });
    expect(checkTree({ products: true }, st([3, 10]))).toBeNull();
    expect(checkTree({ products: true }, st([11, 10]))?.code).toBe('added-along-branch');
    expect(checkTree({ products: true }, st([9, 25]))?.code).toBe('replacement-ignored');
    expect(checkTree({ products: true }, st([1, 5]))?.code).toBe('product-wrong');
    expect(checkTree({ products: true }, base({ product: { x: { got: null, truth: [1, 2], add: null } } }))?.code).toBe('product-empty');
    expect(checkTree({ products: true }, st([1, 5]), [{ product: 'r.r', value: [1, 5], code: 'p' }])?.code).toBe('p');
  });
  it('counts of a frequency tree: the branches must add up to the node', () => {
    const count = (b: number | null, g: number | null) => ({ '': { ask: false, got: null, truth: 100 }, b: { ask: true, got: b, truth: 60 }, g: { ask: true, got: g, truth: 40 } });
    expect(checkTree({ counts: true }, base({ count: count(60, 40) }))).toBeNull();
    expect(checkTree({ counts: true }, base({ count: count(60, null) }))?.code).toBe('count-empty');
    expect(checkTree({ counts: true }, base({ count: count(60, 50) }))?.code).toBe('parts-not-total');
    expect(checkTree({ counts: true }, base({ count: count(50, 50) }))?.code).toBe('count-wrong');
    expect(checkTree({ counts: true }, base({ count: count(60, 50) }), [{ node: 'g', value: 50, code: 'n' }])?.code).toBe('n');
  });
  it('event: the leaves picked', () => {
    const c = { event: ['r.r', 'b.b'] };
    expect(checkTree(c, base({ picked: ['b.b', 'r.r'] }))).toBeNull();
    expect(checkTree(c, base())?.code).toBe('event-empty');
    expect(checkTree(c, base({ picked: ['r.r'] }))?.code).toBe('event-missing');
    expect(checkTree(c, base({ picked: ['r.r', 'b.b', 'r.b'] }))?.code).toBe('event-extra');
    expect(checkTree(c, base({ picked: ['r.r'] }), [{ leaves: ['r.r'], code: 'one' }])?.code).toBe('one');
  });
});

describe('through the sets check', () => {
  it('runs the tree condition before the typed answer, and names 3 + 2 for 3 × 2', () => {
    const check = { type: 'sets' as const, tree: { grown: true }, answer: 6 };
    const nodes = [{ path: '', got: ['a', 'b', 'c'], truth: ['a', 'b', 'c'], gone: [] }];
    expect(checkSets(check, { tree: base({ nodes: [{ ...nodes[0], got: [] }] }) }, { integer: 6 }).code).toBe('not-grown');
    expect(checkSets(check, { tree: base({ nodes }) }, { integer: 5 }).code).toBe('sum-not-product');
    expect(checkSets({ ...check, traps: [{ answer: 5, code: 'added' }] }, { tree: base({ nodes }) }, { integer: 5 }).code).toBe('added');
    expect(checkSets(check, { tree: base({ nodes }) }, { integer: 9 }).code).toBe('too-big');
    expect(evaluate(check, { state: { sets: { tree: base({ nodes }) } }, integer: 6 }).ok).toBe(true);
  });
  it('a branch trap is not mistaken for a probability trap', () => {
    const check = { type: 'sets' as const, probability: [3, 10] as [number, number], traps: [{ branch: 'r.r', value: [9, 25], code: 'b' }, { value: [9, 25], code: 'with-back' }] };
    expect(checkSets(check, {}, { fraction: { n: 9, d: 25 } }).code).toBe('with-back');
    expect(checkSets(check, {}, { fraction: { n: 6, d: 20 } }).ok).toBe(true);
  });
});
