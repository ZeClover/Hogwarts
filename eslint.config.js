import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default [
  { ignores: ['dist/**', 'public/blob-client.js', 'node_modules/**', 'public/assets/**', 'work/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: {
    getComputedStyle: 'readonly', URLSearchParams: 'readonly', process: 'readonly', Buffer: 'readonly', Blob: 'readonly', console: 'readonly', URL: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
    fetch: 'readonly', document: 'readonly', window: 'readonly', history: 'readonly',
    location: 'readonly', FormData: 'readonly', FileReader: 'readonly', requestAnimationFrame: 'readonly',
    HTMLFormElement: 'readonly', HTMLInputElement: 'readonly', navigator: 'readonly'
  } }, rules: { '@typescript-eslint/no-explicit-any': 'error' } }
];
