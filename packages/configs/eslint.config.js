// @ts-check

import graphqlPlugin from '@graphql-eslint/eslint-plugin';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

import shared from '../../eslint.config.shared.js';

export default defineConfig(
  ...shared,
  {
    files: ['src/**/*.graphql'],
    languageOptions: {
      parser: graphqlPlugin.parser,
      parserOptions: {
        graphQLConfig: {
          schema: './src/**/*.graphql',
        },
      },
    },
    plugins: {
      '@graphql-eslint': graphqlPlugin,
    },
    rules: {
      ...graphqlPlugin.configs['flat/schema-recommended'].rules,

      '@graphql-eslint/strict-id-in-types': 'off',
      '@graphql-eslint/require-description': 'off',
      '@graphql-eslint/description-style': 'off',
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
