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
    settings: {
      react: { version: 'detect' },
    },
  },
  ...graphqlConfigForSchema(
    [import.meta.resolve('lucuma-schemas/odb'), import.meta.resolve('lucuma-schemas/navigate')],
    './src/gql/{server,odb}',
  ),
  // @graphql-eslint tries to merge all schemas, even if defined separately. Because some same names are used but with different types we can't enable linting for both server/odb and configs at the same time
  // ...graphqlConfigForSchema(
  //   join(dirname(fileURLToPath(import.meta.resolve('navigate-configs'))), '..', 'src/**/*.graphql'),
  //   './src/gql/configs',
  // ),
);

/**
 * Create a GraphQL ESLint config for a specific schema.
 *
 * @param {string | string[]} schema schema location
 * @param {string} base base directory for the TS files containing the GraphQL operations
 * @returns {Parameters<typeof defineConfig>} ESLint config for GraphQL files
 */
function graphqlConfigForSchema(schema, base) {
  return [
    {
      files: [`${base}/*.{ts,tsx}`],
      processor: graphqlPlugin.processor,
    },
    {
      files: [`${base}/**/*.graphql`],
      languageOptions: {
        parser: graphqlPlugin.parser,
        parserOptions: {
          graphQLConfig: {
            schema,
            documents: [`${base}/**/*.{ts,tsx}`],
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
      },
    },
  ];
}
