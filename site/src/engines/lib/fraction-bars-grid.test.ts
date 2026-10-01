import { describe, expect, it } from 'vitest';
import { gridState, isTinted, nextPartsShowing, nextRows, totalCells } from './fraction-bars-grid';
import { evaluate } from '../../lib/checks';

describe('fraction-bars area model and given cells', () => {
  it('an area-model bar has rows × columns cells', () => {
    expect(totalCells(3)).toBe(3);
    expect(totalCells(3, 2)).toBe(6);
    expect(totalCells(4, 0)).toBe(4);
  });

  it('tint covers the first columns of every row', () => {
    // 3 columns × 2 rows, first 2 columns tinted: cells 0,1 and 3,4
    expect([0, 1, 2, 3, 4, 5].map((i) => isTinted(i, 3, 2))).toEqual([true, true, false, true, true, false]);
    expect(isTinted(0, 3)).toBe(false);
  });

  it('state reports rows × columns parts, so ½ of ⅔ shaded on a 2 × 3 grid is 2/6', () => {
    const cells = [true, true, false, false, false, false];
    const state = gridState(3, 2, cells);
    expect(state).toEqual({ parts: 6, shaded: 2 });
    expect(evaluate({ type: 'shaded-equals', value: [2, 6], exact: true }, { state: { bars: [state] } }).ok).toBe(true);
    // One whole column on the 1-row bar is the right amount but not split into rows
    expect(evaluate({ type: 'shaded-equals', value: [2, 6], exact: true }, { state: { bars: [gridState(3, 1, [true, false, false])] } }).code).toBe('wrong-denominator');
  });

  it('rows stay in range', () => {
    expect(nextRows(1, 1)).toBe(2);
    expect(nextRows(1, -1)).toBeNull();
    expect(nextRows(6, 1)).toBeNull();
    expect(nextRows(3, 1, 1, 3)).toBeNull();
  });

  it('re-partitioning skips partitions that cannot show the given amount', () => {
    // given ½ on 2 parts: + goes 2 → 4 (3 cannot show a half)
    expect(nextPartsShowing(2, 1, 1, 2)).toBe(4);
    expect(nextPartsShowing(4, -1, 1, 2)).toBe(2);
    expect(nextPartsShowing(2, -1, 1, 2)).toBeNull();
    expect(nextPartsShowing(12, 1, 1, 2)).toBeNull();
    // given ¾: 4 → 8 → 12
    expect(nextPartsShowing(4, 1, 3, 4)).toBe(8);
    expect(nextPartsShowing(8, 1, 3, 4)).toBe(12);
    // a whole bar can be split any way
    expect(nextPartsShowing(1, 1, 1, 1)).toBe(2);
  });
});
