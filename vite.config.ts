import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createFilter } from '@rollup/pluginutils';
import { createInstrumenter } from 'istanbul-lib-instrument';

// Minimal Istanbul instrumentation for Vite 7 so `playwright-test-coverage`
// can collect coverage from the dev server. We avoid the vite-plugin-istanbul
// package (currently limited to Vite <=6) and instrument source files directly.
function istanbulPlugin({ include = 'src/**/*.ts?(x)', exclude = ['tests/**/*', 'node_modules/**/*'], enabled = true } = {}) {
  const filter = createFilter(include, exclude);
  const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: true });

  return {
    name: 'vite-istanbul-lite',
    enforce: 'post',
    apply: 'serve', // only needed for dev server used by Playwright
    transform(code, id) {
      const cleanId = id.split('?')[0];
      if (!enabled || !filter(cleanId)) return null;
      const result = instrumenter.instrumentSync(code, cleanId);
      const map = instrumenter.lastSourceMap();
      return { code: result, map };
    },
  };
}

export default defineConfig(({ mode, command }) => {
  // Enable instrumentation for Playwright and CI, keep prod builds clean.
  const enableCoverage = command === 'serve' || process.env.CI === 'true' || process.env.PLAYWRIGHT_COVERAGE === '1';
  // Default to `/` (works for custom domains). For GitHub Pages project sites
  // (served from `/<repo>/`), set `VITE_BASE=/<repo>/` in the workflow.
  const base = process.env.VITE_BASE || '/';

  return {
    base,
    plugins: [
      react(),
      istanbulPlugin({
        enabled: enableCoverage,
        // Vite passes absolute file paths; match anything under /src.
        include: ['**/src/**/*.{js,jsx,ts,tsx}'],
      }),
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  };
});
