import { describe, expect, it } from 'vitest';
import { rich } from './richtext';

describe('rich', () => {
  it('allows <b>, <i>, <br> and escapes everything else', () => {
    expect(rich('a <b>b</b> <i>c</i><br>', 'en')).toBe('a <b>b</b> <i>c</i><br>');
    expect(rich('<script>x</script> <b onclick="x">y</b> 1 < 2', 'en')).toBe('&lt;script&gt;x&lt;/script&gt; &lt;b onclick="x"&gt;y</b> 1 &lt; 2');
  });

  it('stacks fractions and localises numbers per locale', () => {
    expect(rich('{{frac:3/4}}', 'fa-IR')).toContain('<span class="frac-n">۳</span>');
    expect(rich('{{num:2.5}}', 'fa-IR')).toBe('۲/۵');
    expect(rich('{{num:2.5}}', 'fa-AF')).toBe('۲,۵');
    expect(rich('{{num:2.5}}', 'en')).toBe('2.5');
  });

  it('writes coordinate pairs as a column in fa-IR and as (x, y) elsewhere', () => {
    expect(rich('{{vec:4,2}}', 'fa-IR')).toBe('<span class="vec" role="math" aria-label="(4, 2)"><span>۴</span><span>۲</span></span>');
    expect(rich('{{vec:-3, 1}}', 'fa-AF')).toBe('<bdi dir="ltr" class="pair">(<bdi dir="ltr">-۳</bdi>, ۱)</bdi>');
    expect(rich('{{vec:4,2}}', 'en')).toBe('<bdi dir="ltr" class="pair">(4, 2)</bdi>');
  });
});

describe('set notation', () => {
  it('writes braces from [ ], left to right, with locale digits and separator', () => {
    expect(rich('{{set:A = [2, 4]}} است', 'fa-IR')).toBe('<bdi dir="ltr" class="set">A = {۲, ۴}</bdi> است');
    // "," is the decimal mark in fa-AF and ps, so elements are separated by the Arabic comma
    expect(rich('{{set:A = [2,4]}}', 'fa-AF')).toBe('<bdi dir="ltr" class="set">A = {۲، ۴}</bdi>');
    expect(rich('{{set:[4] ⊆ A}}', 'en')).toBe('<bdi dir="ltr" class="set">{4} ⊆ A</bdi>');
    expect(rich('{{set:∅ ≠ [0]}}', 'ps')).toBe('<bdi dir="ltr" class="set">∅ ≠ {۰}</bdi>');
  });
});

describe('interval notation', () => {
  it('runs left to right with −, ∞, ∪ and the locale separator and decimal mark', () => {
    expect(rich('بازهٔ {{interval:[-2, 4)}}', 'fa-IR')).toBe('بازهٔ <bdi dir="ltr" class="set">[−۲, ۴)</bdi>');
    expect(rich('{{interval:[-2, 4)}}', 'fa-AF')).toBe('<bdi dir="ltr" class="set">[−۲، ۴)</bdi>');
    expect(rich('{{interval:(-inf, 1.5] U (3, inf)}}', 'en')).toBe('<bdi dir="ltr" class="set">(−∞, 1.5] ∪ (3, ∞)</bdi>');
    expect(rich('{{interval:(-inf, 1.5]}}', 'fa-IR')).toBe('<bdi dir="ltr" class="set">(−∞, ۱/۵]</bdi>');
  });
});

describe('algebra', () => {
  it('writes {{alg:…}} left to right with locale digits, − and raised powers; letters stay Latin', () => {
    expect(rich('{{alg:3x^2 - 2x + 1}}', 'fa-IR')).toBe('<bdi dir="ltr" class="alg">۳x<sup>۲</sup> − ۲x + ۱</bdi>');
    expect(rich('{{alg:x = -3}}', 'ps')).toBe('<bdi dir="ltr" class="alg">x = −۳</bdi>');
    expect(rich('{{alg:4 - (-3)^2}}', 'en')).toBe('<bdi dir="ltr" class="alg">4 − (−3)<sup>2</sup></bdi>');
    expect(rich('{{alg:2*3 < 7}}', 'en')).toBe('<bdi dir="ltr" class="alg">2×3 &lt; 7</bdi>');
  });

  it('is not broken by the formula isolates of RTL text', () => {
    expect(rich('یعنی {{alg:2 + 3}} = ۵', 'fa-IR')).not.toMatch(/⁦[^⁩]*alg/);
    expect(rich('{{alg:x + 2 + 3}}', 'fa-IR')).toBe('<bdi dir="ltr" class="alg">x + ۲ + ۳</bdi>');
  });
});

describe('formula direction', () => {
  it('wraps operator expressions in RTL locales in left-to-right isolates', () => {
    const out = rich('{{frac:3/4}} − {{frac:1/3}} چقدر است؟', 'fa-IR');
    expect(out.startsWith('⁦<span class="frac"')).toBe(true);
    expect(out).toContain('</span></span>⁩ چقدر');
    expect(rich('۳ × {{frac:2/5}} یعنی', 'fa-IR')).toMatch(/^⁦۳ × <span/);
    expect(rich('۸۴ ÷ ۴ = ۲۱', 'fa-IR')).toBe('⁦۸۴ ÷ ۴ = ۲۱⁩');
    expect(rich('یعنی ۲۵٪ = ۰/۲۵ است', 'fa-IR')).toBe('یعنی ⁦۲۵٪ = ۰/۲۵⁩ است');
    expect(rich('{{num:0.6}} = ۶۰٪', 'fa-AF')).toBe('⁦۰,۶ = ۶۰٪⁩');
  });

  it('leaves plain numbers, single fractions and English alone', () => {
    expect(rich('۴ قسمت', 'fa-IR')).toBe('۴ قسمت');
    expect(rich('{{frac:1/4}} نوار', 'fa-IR')).not.toContain('⁦');
    expect(rich('{{frac:3/4}} − {{frac:1/3}}', 'en')).not.toContain('⁦');
  });
});
