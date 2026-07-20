// @ts-check

import graphqlPlugin from '@graphql-eslint/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { importX } from 'eslint-plugin-import-x';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';

import shared from '../../eslint.config.shared.js';

export default defineConfig(
  // The checked-in SSO schema is SDL consumed by codegen/graphql-config, not
  // an operations document — nothing to lint.
  { ignores: ['src/gql/sso/Sso.graphql'] },
  ...shared,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  importX.flatConfigs.react,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite(),
  {
    files: [`./src/gql/*.{ts,tsx}`, `./src/gql/sso/*.ts`],
    processor: graphqlPlugin.processor,
  },
  {
    files: [`./src/gql/**/*.graphql`],
    languageOptions: {
      parser: graphqlPlugin.parser,
      parserOptions: {
        graphQLConfig: {
          // One project per endpoint; a document belongs to whichever
          // project's globs match its source file.
          projects: {
            odb: {
              schema: import.meta.resolve('@gemini-hlsw/lucuma-schemas/odb'),
              documents: [`./src/gql/*.{ts,tsx}`, `./src/features/**/*.tsx`, `./src/components/**/*.tsx`],
            },
            sso: {
              schema: `./src/gql/sso/Sso.graphql`,
              documents: [`./src/gql/sso/*.ts`],
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

      '@graphql-eslint/naming-convention': ['error', { types: 'PascalCase', FieldDefinition: 'camelCase' }],
      '@graphql-eslint/require-selections': ['error', { fieldName: ['id', 'pk'] }],
      // Observation rows nested under program matches reach coordinates at
      // depth 9 (programs > matches > observations > matches > target
      // environment > target > sidereal > ra) — intrinsic ODB nesting, not
      // an over-fetch.
      '@graphql-eslint/selection-set-depth': ['error', { maxDepth: 9 }],
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
