import { defineConfig } from 'astro/config';

// Fully static output: the whole site must work offline and be zippable per grade.
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: { inlineStylesheets: 'auto' },
});
