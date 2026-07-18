import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Flat config, intentionally lean (see CLAUDE.md — lint was reserved for the
 * `check` gate). Non-type-checked recommended rules keep it fast and low-noise;
 * tighten per-rule as the codebase earns it rather than importing a wall of
 * warnings on day one.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // Allow deliberate `_`-prefixed unused args/vars (existing convention here).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Server + domain run on Node.
  {
    files: ['packages/{server,domain}/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Client runs in the browser; enforce the rules of hooks (guards the
  // design-for-failure surface — data-hooks/autosave — that is the weak spot).
  {
    files: ['packages/client/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  // Test files also touch Node globals + vitest.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'packages/server/test/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
