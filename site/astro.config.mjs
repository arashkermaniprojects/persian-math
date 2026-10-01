import { defineConfig } from 'astro/config';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const LOCALES = ['fa-IR', 'fa-AF', 'ps', 'en'];

/**
 * After the build, write dist/precache.json: the files each locale needs offline.
 * The service worker downloads one locale's list after the learner's first visit (public/sw.js).
 */
function precacheManifest() {
  return {
    name: 'kamangir-precache',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
        const url = (f) => '/' + relative(root, f).split('\\').join('/').replace(/index\.html$/, '');
        const files = walk(root).filter((f) => !/\.(map|txt)$/.test(f) && !f.endsWith('precache.json') && !f.endsWith('sw.js'));
        const out = { version: Date.now().toString(36), shared: [] };
        for (const f of files) {
          const top = relative(root, f).split(/[\\/]/)[0];
          if (top === 'review') continue;
          const key = LOCALES.includes(top) ? top : 'shared';
          (out[key] ??= []).push(url(f));
        }
        // KaTeX ships fonts for every style; only precache the ones formulas actually use.
        out.shared = out.shared.filter((u) => !u.startsWith('/fonts/katex/') || /KaTeX_(Main|Math|Size\d)-/.test(u));
        writeFileSync(join(root, 'precache.json'), JSON.stringify(out));
      },
    },
  };
}

// Fully static output: the whole site must work offline and be zippable per locale.
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
  integrations: [precacheManifest()],
});
