// @ts-check

import graphqlPlugin from '@graphql-eslint/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';

import shared, { vitest } from '../../eslint.config.shared.js';

// The globs `tasks/codegen.ts` collects documents from, so no document codegen compiles escapes lint.
const documents = ['./src/gql/**/*.ts', './src/**/*.tsx'];

export default defineConfig(
  ...shared,
  ...vitest,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  importX.flatConfigs.react,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite(),
  {
    files: documents,
    processor: graphqlPlugin.processor,
  },
  {
    files: ['./src/**/*.graphql'],
    languageOptions: {
      parser: graphqlPlugin.parser,
      parserOptions: {
        graphQLConfig: {
          projects: {
            resource: {
              schema: import.meta.resolve('@gemini-hlsw/lucuma-odb-schemas/resource'),
              documents,
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
  {
    files: ['tasks/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    settings: {
      react: { version: '19.2' },
    },
  },
);
