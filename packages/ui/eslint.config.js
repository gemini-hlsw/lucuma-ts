// @ts-check

import graphqlPlugin from '@graphql-eslint/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';

import shared, { vitest } from '../../eslint.config.shared.js';

export default defineConfig(
  ...shared,
  ...vitest,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  importX.flatConfigs.react,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite(),
  {
    settings: {
      react: { version: '19.2' },
    },
  },
  {
    files: [`./src/gql/{odb,server,configs}/*.{ts,tsx}`],
    processor: graphqlPlugin.processor,
  },
  {
    files: [`./src/gql/**/*.graphql`],
    languageOptions: {
      parser: graphqlPlugin.parser,
      parserOptions: {
        graphQLConfig: {
          projects: {
            odb: {
              schema: import.meta.resolve('@gemini-hlsw/lucuma-odb-schemas/odb'),
              documents: [`./src/gql/odb/*.{ts,tsx}`],
            },
            server: {
              schema: import.meta.resolve('@gemini-hlsw/lucuma-apps-schemas/navigate'),
              documents: [`./src/gql/server/*.{ts,tsx}`],
            },
            configs: {
              schema: '../configs/src/**/*.graphql',
              documents: [`./src/gql/configs/*.{ts,tsx}`],
            },
          },
        },
      },
    },
    plugins: {
      '@graphql-eslint': graphqlPlugin,
    },
    rules: {
      ...graphqlPlugin.configs['flat/operations-recommended'].rules,

      '@graphql-eslint/require-selections': ['error', { fieldName: ['id', 'pk'] }],
    },
  },
);
