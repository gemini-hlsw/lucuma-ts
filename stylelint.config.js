/** @type {import("stylelint").Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'import-notation': null,
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['theme'],
      },
    ],
  },
  languageOptions: {
    syntax: {
      atRules: {
        'custom-variant': {
          comment: 'Tailwind custom variant',
        },
      },
    },
  },
};
