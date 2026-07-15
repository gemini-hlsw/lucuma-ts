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
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()], exclude: /[/\\](node_modules|common-ui)[/\\]/ }),
    tailwindcss(),
  ],
  server: {
    allowedHosts: ['localhost', '.lucuma.xyz', '.gemini.edu'],
    proxy: {
      // Admin talks to two GraphQL services: the ODB for Programs / Proposals /
      // Change Requests / Calls for Proposals, and SSO for the Users view's
      // roster + addRole. Both proxied to the dev environment in local dev.
      '/odb': {
        target: 'https://lucuma-postgres-odb-dev.herokuapp.com',
        changeOrigin: true,
        secure: true,
      },
      '/sso-graphql': {
        target: 'https://sso-dev.gpp.lucuma.xyz',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/sso-graphql/, '/graphql'),
      },
      // The archive's public jsonsummary API (sc-9244 duplication check)
      // sends no CORS headers, so the browser must reach it same-origin.
      // Deployed builds need an equivalent (hosting-level proxy or
      // archive-side CORS); until then the duplicates table degrades with
      // the fetch error rather than faking an empty result.
      '/archive': {
        target: 'https://archive.gemini.edu',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/archive/, ''),
      },
    },
  },
  test: {
    clearMocks: true,
    globals: true,
    setupFiles: [
      '@gemini-hlsw/lucuma-common-ui/test/setup.ts',
      '@gemini-hlsw/lucuma-common-ui/test/disable-animations.css',
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
          viewport: { width: 1280, height: 900 },
        },
      ],
    },
  },
});
