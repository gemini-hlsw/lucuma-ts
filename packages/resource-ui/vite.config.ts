import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { execSync } from 'child_process';
import { defineConfig } from 'vitest/config';

import pkgJson from './package.json' with { type: 'json' };

const version = (process.env.GITHUB_REF_NAME || `v${pkgJson.version}`).trim();
const commitHash = (process.env.GITHUB_SHA || execSync('git rev-parse --short HEAD').toString()).trim().slice(0, 7);

const buildTime = new Date();
function formatDate(date: Date) {
  const years = date.getFullYear();
  // Months are 0-indexed
  const months = date.getMonth() + 1;
  const days = date.getDate();
  return `${years}${months.toString().padStart(2, '0')}${days.toString().padStart(2, '0')}`;
}
const frontendVersion = `${version}+${formatDate(buildTime)}.${commitHash}`;

// https://vite.dev/config/
export default defineConfig({
  define: {
    'import.meta.env.FRONTEND_VERSION': JSON.stringify(frontendVersion),
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      visitor: {
        Selector(selector) {
          // Filter out :root selectors that are not the first rule
          if (selector.find((v, i) => v.type === 'pseudo-class' && v.kind === 'root' && i > 0)) {
            return selector.filter((v, i) => i < 1 || !(v.type === 'pseudo-class' && v.kind === 'root'));
          }
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()], exclude: /[/\\](node_modules|common-ui)[/\\]/ }),
    tailwindcss(),
  ],
  optimizeDeps: {
    // Pre-bundle these so the browser test runner does not reload mid-run.
    //
    // Every Highcharts master must be listed. A module composes itself onto the
    // core's prototypes at import time, so one left out is pre-bundled into its
    // own chunk with its own copy of the core and composes onto that instead -
    // which surfaces as `Cannot read properties of undefined (reading
    // 'prototype')` from ColorAxis.compose, not as a missing module.
    include: [
      '@apollo/client',
      '@apollo/client/link/schema',
      '@apollo/client/react',
      '@highcharts/react',
      'highcharts/es-modules/masters/highcharts.src.js',
      'highcharts/es-modules/masters/modules/heatmap.src.js',
      'highcharts/es-modules/masters/modules/xrange.src.js',
      'react-big-calendar',
      'date-fns',
      'date-fns/locale',
      'primereact/accordion',
      'primereact/button',
      'primereact/column',
      'primereact/datatable',
      'primereact/dropdown',
      'primereact/inputtext',
      'primereact/selectbutton',
      'primereact/tag',
      'graphql',
      'graphql-yoga',
    ],
  },
  server: {
    allowedHosts: ['localhost', '.lucuma.xyz', '.gemini.edu'],
    proxy: {
      // "Live server" means the actual Resource service, in development too -
      // the proxy only exists to sidestep CORS, never to stand something else
      // in for the real endpoint. The local mock server (pnpm dev:mock-server)
      // hosts the demo data over HTTP for GraphiQL and external consumers at
      // :4000 directly; it is not part of this path.
      '/resource/graphql': {
        target: 'https://lucuma-resource-dev.lucuma.xyz',
        changeOrigin: true,
      },
    },
  },
  test: {
    clearMocks: true,
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: [
      '@gemini-hlsw/lucuma-common-ui/test/setup.ts',
      '@gemini-hlsw/lucuma-common-ui/test/disable-animations.css',
      // The app's own stylesheet, exactly as main.tsx loads it. Styling is
      // behaviour here: the sun wash is only pointer-transparent because
      // global.css says so, and a hover test can only prove that with the
      // stylesheet applied.
      './src/styles/global.css',
    ],
    browser: {
      enabled: true,
      provider: playwright({
        actionTimeout: 10_000,
        contextOptions: {
          // Disable animations in tests to speed them up
          reducedMotion: 'reduce',
        },
      }),
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
          retry: process.env.CI ? 2 : 0,
          viewport: { width: 834, height: 1112 },
        },
      ],
    },
  },
});
