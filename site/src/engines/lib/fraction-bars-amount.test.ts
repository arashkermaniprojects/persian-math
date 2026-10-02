import { describe, expect, it } from 'vitest';
import { cellsFor, nextParts } from './fraction-bars-amount';

describe('fraction-bars amount helpers', () => {
  it('cellsFor shades the same amount on a finer or coarser partition', () => {
    expect(cellsFor(1, 3, 6)).toBe(2);
    expect(cellsFor(2, 3, 12)).toBe(8);
    expect(cellsFor(6, 8, 4)).toBe(3);
    expect(cellsFor(0, 5, 10)).toBe(0);
    expect(cellsFor(5, 4, 8)).toBe(10);
  });

  it('cellsFor is null when the partition cannot show the amount', () => {
    expect(cellsFor(1, 3, 4)).toBeNull();
    expect(cellsFor(1, 3, 5)).toBeNull();
    expect(cellsFor(6, 8, 2)).toBeNull();
    expect(cellsFor(1, 0, 4)).toBeNull();
  });

  it('nextParts steps by the given size and stays in range', () => {
    expect(nextParts(4, 1)).toBe(5);
    expect(nextParts(3, 1, 3)).toBe(6);
    expect(nextParts(12, 1, 3)).toBeNull();
    expect(nextParts(6, -1, 3, 3)).toBe(3);
    expect(nextParts(3, -1, 3, 3)).toBeNull();
    expect(nextParts(1, -1)).toBeNull();
    expect(nextParts(12, 1)).toBeNull();
    expect(nextParts(12, 1, 1, 1, 24)).toBe(13);
  });
});
