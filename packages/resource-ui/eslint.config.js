// @ts-check

import graphqlPlugin from '@graphql-eslint/eslint-plugin';
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
    files: [`./src/gql/*.{ts,tsx}`],
    processor: graphqlPlugin.processor,
  },
  {
    files: [`./src/gql/**/*.graphql`],
    languageOptions: {
      parser: graphqlPlugin.parser,
      parserOptions: {
        graphQLConfig: {
          schema: import.meta.resolve('@gemini-hlsw/lucuma-schemas/resource'),
          documents: [`./src/gql/**/*.{ts,tsx}`],
        },
      },
    },
    plugins: {
      // @ts-expect-error - incorrect type
      '@graphql-eslint': graphqlPlugin,
    },
    rules: {
      ...graphqlPlugin.configs['flat/operations-recommended'].rules,

      '@graphql-eslint/naming-convention': ['error', { types: 'PascalCase', FieldDefinition: 'camelCase' }],
      '@graphql-eslint/require-selections': ['error', { fieldName: ['id', 'pk'] }],
    },
  },
  {
    files: ['mock-server/**/*.ts', 'tasks/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    settings: {
      react: { version: 'detect' },
    },
  },
);
