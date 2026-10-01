// Builds per-locale offline bundles that open straight from a file manager / SD card (file://), no server needed.
// Usage (after `npm run build`): node scripts/offline-bundle.mjs  →  bundles/kamangir-<locale>.zip
//
// What it does to a copy of dist/:
//  - rewrites root-absolute URLs ("/fonts/…", "/fa-IR/…") to relative ones, because file:// has no site root;
//  - points directory links ("…/studio/x/") at their index.html, because file:// doesn't serve directory indexes;
//  - keeps only the shared assets plus the one locale's pages, so each zip stays small;
//  - swaps the ES-module studio runtime for one classic script, because Chrome won't load modules from file://.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';

const DIST = 'dist';
const OUT = 'bundles';
const LOCALES = readdirSync(DIST).filter((d) => /^(fa-IR|fa-AF|ps|en)$/.test(d));
const SHARED = readdirSync(DIST).filter((d) => !LOCALES.includes(d) && d !== 'review' && d !== 'index.html');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Turn "/a/b/" or "/a/b.css" (site-absolute) into a path relative to `fromFile`. */
function rel(fromFile, url, root) {
  const [path, rest = ''] = url.split(/(?=[?#])/);
  let target = join(root, path);
  if (path.endsWith('/')) target = join(target, 'index.html');
  let r = relative(dirname(fromFile), target) || 'index.html';
  if (!r.startsWith('.')) r = './' + r;
  return r + rest;
}

function rewrite(file, root) {
  let s = readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    s = s.replace(/(\s(?:href|src|content)=")(\/(?!\/)[^"]*)"/g, (_m, attr, url) => `${attr}${rel(file, url, root)}"`);
    s = s.replace(/url=\/(?!\/)([^"]*)/g, (_m, url) => `url=${rel(file, '/' + url, root)}`); // meta refresh
  }
  if (file.endsWith('.css') || file.endsWith('.html')) {
    s = s.replace(/url\((['"]?)\/(?!\/)([^)'"]+)\1\)/g, (_m, q, url) => `url(${q}${rel(file, '/' + url, root)}${q})`);
  }
  writeFileSync(file, s);
}

if (!existsSync(DIST)) throw new Error('Run `npm run build` first.');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

for (const locale of LOCALES) {
  const root = join(OUT, `kamangir-${locale}`);
  mkdirSync(root, { recursive: true });
  for (const d of [...SHARED, locale]) cpSync(join(DIST, d), join(root, d), { recursive: true });
  // Entry page at the top of the folder: opens this locale's home.
  writeFileSync(
    join(root, 'index.html'),
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./${locale}/index.html"><a href="./${locale}/index.html">Kamangir</a>`
  );
  // Classic-script build of the studio runtime with every engine inlined (no dynamic import over file://).
  buildSync({ entryPoints: ['src/client/studio.ts'], bundle: true, format: 'iife', minify: true, outfile: join(root, '_offline/studio.js') });
  for (const f of walk(root)) {
    if (/\.(html|css)$/.test(f)) rewrite(f, root);
    if (f.endsWith('.html')) {
      const html = readFileSync(f, 'utf8');
      if (!html.includes('id="studio-data"')) continue;
      const swapped = html.replace(/<script type="module" src="[^"]*"><\/script>/, `<script src="${rel(f, '/_offline/studio.js', root)}" defer></script>`);
      if (swapped === html) throw new Error(`No module script to replace in ${f}`);
      writeFileSync(f, swapped);
    }
  }
  execFileSync('zip', ['-qr', `../kamangir-${locale}.zip`, '.'], { cwd: root });
  const size = statSync(join(OUT, `kamangir-${locale}.zip`)).size;
  console.log(`kamangir-${locale}.zip  ${(size / 1024 / 1024).toFixed(2)} MB`);
  if (size > 15 * 1024 * 1024) throw new Error(`${locale} bundle exceeds the 15 MB budget (PLAN.md Phase 1)`);
}
