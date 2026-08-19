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
  server: {
    allowedHosts: ['localhost', '.lucuma.xyz', '.gemini.edu'],
    proxy: {
      /*
       * Where `pnpm dev` gets its data. The real Resource service by default -
       * the proxy exists to sidestep CORS, and it never stands something else in
       * for the real endpoint unless asked.
       *
       * `RESOURCE_API=mock` (or `pnpm dev:mock`) points it at the local mock
       * server instead, which is worth having because the deployment does not
       * serve the v1 API yet, so the default is the live-failure banner and empty
       * views until the Scala service ships.
       *
       * A switch here rather than in the app, deliberately. The mock schema was
       * once executed in the browser behind a masthead control, and that put
       * graphql-yoga, an executable schema and the SDL - 245 kB of server-side
       * code - into the frontend bundle (2026-08-14, Hugo's review). This adds no
       * link, no control and nothing to the bundle: the app still makes one HTTP
       * request to one path, and only which process answers on localhost changes.
       *
       * Two things to know when the mock is the target. `pnpm dev:mock-server`
       * has to be running or every query 502s, and a mock server left over from
       * an old session serves a schema that no longer exists - see "Treat port
       * 4000 as untrusted" in CLAUDE.md.
       *
       * Only localhost goes through here. A deployed build resolves its endpoint
       * by hostname (`graphqlEndpoints` in `src/gql/ApolloConfigs.ts`) and never
       * touches this proxy.
       */
      '/resource/graphql':
        process.env.RESOURCE_API === 'mock'
          ? {
              // Yoga serves `/graphql`; the app asks for `/resource/graphql`.
              target: 'http://localhost:4000',
              changeOrigin: true,
              rewrite: (path: string) => path.replace(/^\/resource\/graphql/, '/graphql'),
            }
          : { target: 'https://lucuma-resource-dev.lucuma.xyz', changeOrigin: true },
    },
  },
  test: {
    clearMocks: true,
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**'],
    // No app stylesheet here, deliberately: a test that needs styling to pass
    // is testing the stylesheet. The one rule that is behaviour rather than
    // appearance - Highcharts overlays must not catch the pointer - lives in
    // `src/styles/chartOverlays.css`, which the one test that asserts it
    // imports for itself.
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
          viewport: { width: 834, height: 1112 },
        },
      ],
    },
  },
});
