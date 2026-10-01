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
});

describe('formula direction', () => {
  it('wraps operator expressions in RTL locales in left-to-right isolates', () => {
    const out = rich('{{frac:3/4}} − {{frac:1/3}} چقدر است؟', 'fa-IR');
    expect(out.startsWith('⁦<span class="frac"')).toBe(true);
    expect(out).toContain('</span></span>⁩ چقدر');
    expect(rich('۳ × {{frac:2/5}} یعنی', 'fa-IR')).toMatch(/^⁦۳ × <span/);
    expect(rich('۸۴ ÷ ۴ = ۲۱', 'fa-IR')).toBe('⁦۸۴ ÷ ۴ = ۲۱⁩');
  });

  it('leaves plain numbers, single fractions and English alone', () => {
    expect(rich('۴ قسمت', 'fa-IR')).toBe('۴ قسمت');
    expect(rich('{{frac:1/4}} نوار', 'fa-IR')).not.toContain('⁦');
    expect(rich('{{frac:3/4}} − {{frac:1/3}}', 'en')).not.toContain('⁦');
  });
});
