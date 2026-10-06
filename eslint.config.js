import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
export default [
  { ignores: ['**/dist/**', 'node_modules/**'] },
  js.configs.recommended,
  { files: ['client/src/**/*.{js,jsx}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules, 'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }], 'react-hooks/set-state-in-effect': 'off', 'react-hooks/refs': 'off' } },
];
