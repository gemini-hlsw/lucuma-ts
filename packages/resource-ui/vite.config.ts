import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
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
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()], exclude: /[/\\](node_modules|common-ui)[/\\]/ }),
    tailwindcss(),
  ],
  test: {
    clearMocks: true,
    globals: true,
    setupFiles: ['lucuma-common-ui/test/setup.ts', 'lucuma-common-ui/test/disable-animations.css'],
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
