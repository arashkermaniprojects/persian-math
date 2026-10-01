// Fails the build if any locale is missing a UI key, has an extra key, or references an unknown glossary term.
import { readFileSync } from 'node:fs';

const LOCALES = ['fa-IR', 'fa-AF', 'ps', 'en'];
const RTL = new Set(['fa-IR', 'fa-AF', 'ps']);
const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

const ui = Object.fromEntries(LOCALES.map((l) => [l, load(`../src/i18n/ui/${l}.json`)]));
const terms = new Set(load('../../content/glossary.json').terms.map((t) => t.id));
const reference = Object.keys(ui['fa-IR']);
const errors = [];

for (const l of LOCALES) {
  const keys = Object.keys(ui[l]);
  for (const k of reference) if (!keys.includes(k)) errors.push(`${l}: missing key "${k}"`);
  for (const k of keys) if (!reference.includes(k)) errors.push(`${l}: extra key "${k}" (not in fa-IR)`);
  for (const [k, v] of Object.entries(ui[l])) {
    for (const [, id] of v.matchAll(/\{\{term:([\w.-]+)\}\}/g)) if (!terms.has(id)) errors.push(`${l}.${k}: unknown term "${id}"`);
    if (RTL.has(l) && /[0-9]/.test(v.replace(/\{\{[^}]*\}\}/g, ''))) errors.push(`${l}.${k}: Latin digits in RTL text`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`locales OK: ${LOCALES.length} locales × ${reference.length} keys, ${terms.size} glossary terms`);
