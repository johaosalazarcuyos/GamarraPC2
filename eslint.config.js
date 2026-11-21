const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  security.configs.recommended,
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.jest } } },
  { files: ['public/**/*.js'], languageOptions: { sourceType: 'script', globals: globals.browser } },
];
