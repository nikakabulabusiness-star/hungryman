const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
// Config files and scripts run in Node (CommonJS), not in the app bundle.
const nodeGlobals = { __dirname: 'readonly', __filename: 'readonly', require: 'readonly', module: 'writable', exports: 'writable', process: 'readonly', Buffer: 'readonly', console: 'readonly' };
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**'] },
  { files: ['*.js', '*.cjs', 'scripts/**/*.{js,cjs,mjs}'], languageOptions: { globals: nodeGlobals } },
]);
