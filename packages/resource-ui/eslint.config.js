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
    files: [`./src/gql/*.{ts,tsx}`],
    processor: graphqlPlugin.processor,
  },
  {
    files: [`./src/gql/**/*.graphql`],
    languageOptions: {
      parser: graphqlPlugin.parser,
      parserOptions: {
        graphQLConfig: {
          projects: {
            resource: {
              schema: './mock-server/schema.graphql',
              documents: [`./src/gql/*.{ts,tsx}`],
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
    files: ['mock-server/**/*.ts', 'tasks/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@gemini-hlsw/lucuma-common-ui',
              importNames: ['cn'],
              message:
                "Import `cn` from '@/styles/cn': the shared one cannot see this app's `@theme` type scale, and merges a size it does not recognise away as a colour.",
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // `@theme` resets the namespace, so a step above `base` compiles to nothing at all.
          selector: ':matches(Literal, TemplateElement)[value.raw=/(^|[\\s\'"`:])text-(lg|xl|[2-9]xl)($|[\\s\'"`])/]',
          message:
            'The type scale stops at `text-base`. A larger step emits no CSS, so the text silently renders at whatever it inherits.',
        },
        {
          selector: 'Literal[value=/(^|[\\s\'"`:])text-(lg|xl|[2-9]xl)($|[\\s\'"`])/]',
          message:
            'The type scale stops at `text-base`. A larger step emits no CSS, so the text silently renders at whatever it inherits.',
        },
        {
          // A length in the `text-` namespace, so an arbitrary colour or `var()` is left alone.
          selector:
            ':matches(Literal, TemplateElement)[value.raw=/(^|[\\s\'"`:])text-\\[(length:|[0-9.]+(px|rem|em|pt|pc|in|cm|mm|ch|ex|vw|vh|vmin|vmax)\\])/]',
          message:
            'The type scale is `text-2xs`, `text-xs`, `text-sm` and `text-base`. An arbitrary size is one only this component knows; a size outside the scale needs a role in DESIGN.md first.',
        },
        {
          selector:
            'Literal[value=/(^|[\\s\'"`:])text-\\[(length:|[0-9.]+(px|rem|em|pt|pc|in|cm|mm|ch|ex|vw|vh|vmin|vmax)\\])/]',
          message:
            'The type scale is `text-2xs`, `text-xs`, `text-sm` and `text-base`. An arbitrary size is one only this component knows; a size outside the scale needs a role in DESIGN.md first.',
        },
      ],
    },
  },
  {
    settings: {
      react: { version: '19.2' },
    },
  },
);
