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

  // ---- Server layering, enforced rather than documented ----
  // CLAUDE.md: "Routers handle HTTP only ... Services own invariants ... Repos
  // are SQL-only". That held by convention until it didn't: services had
  // accumulated ~46 statements of their own, and five modules had no repo at
  // all. These two rules make the boundary a build failure instead of a code
  // review someone has to remember to do.
  {
    files: ['packages/server/src/modules/**/*.ts'],
    ignores: ['packages/server/src/modules/**/*.repo.ts'],
    rules: {
      // `db.transaction()` is deliberately NOT restricted — services own
      // transactions and cross-entity coordination; only the SQL moves out.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name=/^(prepare|exec)$/]',
          message:
            'SQL belongs in a *.repo.ts. Add a repo function and call it from here (services own invariants and transactions, repos own statements).',
        },
      ],
      // Reaching past a sibling's service into its repo skips the invariants
      // that service enforces. Depend on the owning module's published surface
      // (*.service.ts, or its *.guards.ts for a rule you need without the
      // service's own collaborators).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*/*.repo.js'],
              message:
                "Don't import another module's repo. Use that module's *.service.ts or *.guards.ts so its invariants still apply.",
            },
          ],
        },
      ],
    },
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
