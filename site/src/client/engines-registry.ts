/**
 * Engines load on demand so each page ships only the code it uses.
 * Every src/engines/<name>.ts is an engine named <name> (helpers live in src/engines/lib/), so adding an engine
 * needs no registration. scripts/offline-bundle.mjs swaps this module for static imports (esbuild has no glob).
 */
export const ENGINES: Record<string, () => Promise<unknown>> = Object.fromEntries(
  Object.entries(import.meta.glob(['../engines/*.ts', '!../engines/*.test.ts'])).map(([path, load]) => [
    path.replace(/^.*\/(.+)\.ts$/, '$1'),
    load,
  ])
);
