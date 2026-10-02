import { describe, expect, it } from 'vitest';
import { checkPlaceValue } from './place-value-check';

describe('checkPlaceValue', () => {
  it('passes when the shown number equals the value', () => {
    expect(checkPlaceValue({ type: 'place-value', value: 27 }, { value: '27', counts: [7, 2] })).toEqual({ ok: true });
    expect(checkPlaceValue({ type: 'place-value', value: '3.40' }, { value: '3.4', counts: [0, 4, 3] })).toEqual({ ok: true });
  });

  it('says too big or too small, exactly, for decimals too', () => {
    const c = { type: 'place-value', value: 27 } as const;
    expect(checkPlaceValue(c, { value: '32', counts: [2, 3] }).code).toBe('too-big');
    expect(checkPlaceValue(c, { value: '9', counts: [9, 0] }).code).toBe('too-small');
    expect(checkPlaceValue({ type: 'place-value', value: '0.45' }, { value: '0.5' }).code).toBe('too-big');
    expect(checkPlaceValue({ type: 'place-value', value: '0.45' }, { value: '0.405' }).code).toBe('too-small');
    expect(checkPlaceValue({ type: 'place-value', value: '100' }, { value: '99.9' }).code).toBe('too-small');
  });

  it('reports an empty chart, unless zero is the answer', () => {
    expect(checkPlaceValue({ type: 'place-value', value: 5 }, { value: '0', counts: [0, 0] }).code).toBe('empty');
    expect(checkPlaceValue({ type: 'place-value', value: 5 }, undefined).code).toBe('empty');
    expect(checkPlaceValue({ type: 'place-value', value: 0 }, { value: '0', counts: [0, 0] }).ok).toBe(true);
  });

  it('canonical: ten or more in one place must be exchanged first', () => {
    const c = { type: 'place-value', value: 14, canonical: true } as const;
    expect(checkPlaceValue(c, { value: '14', counts: [14, 0] }).code).toBe('needs-exchange');
    expect(checkPlaceValue(c, { value: '14', counts: [4, 1] }).ok).toBe(true);
    expect(checkPlaceValue({ type: 'place-value', value: 14 }, { value: '14', counts: [14, 0] }).ok).toBe(true);
  });

  it('counts: a required non-standard partition', () => {
    const c = { type: 'place-value', value: 34, counts: [14, 2] } as const;
    expect(checkPlaceValue(c, { value: '34', counts: [14, 2] }).ok).toBe(true);
    expect(checkPlaceValue(c, { value: '34', counts: [4, 3] }).code).toBe('wrong-counts');
  });

  it('traps give known mistakes their own code', () => {
    const c = { type: 'place-value', value: 27, traps: [{ value: 22, code: 'took-ten' }, { value: '30', code: 'took-two' }] } as const;
    expect(checkPlaceValue(c, { value: '22' }).code).toBe('took-ten');
    expect(checkPlaceValue(c, { value: '30' }).code).toBe('took-two');
    expect(checkPlaceValue(c, { value: '31' }).code).toBe('too-big');
  });
});
