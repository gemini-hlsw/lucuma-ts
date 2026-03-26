// @ts-check

import { defineConfig } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';

import shared from '../../eslint.config.shared.js';

export default defineConfig(
  ...shared,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  importX.flatConfigs.react,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite(),
  {
    settings: {
      react: { version: 'detect' },
    },
  },
);
