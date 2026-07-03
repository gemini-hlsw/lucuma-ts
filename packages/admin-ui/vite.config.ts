import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  css: {
    transformer: 'lightningcss',
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()], exclude: /[/\\](node_modules|common-ui)[/\\]/ }), tailwindcss()],
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
