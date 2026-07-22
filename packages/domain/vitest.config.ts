import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      // content/ is verbatim Prosci data (constants), not logic — testing every
      // string is noise; index is a re-export barrel.
      exclude: ['src/content/**', 'src/index.ts', '**/*.test.ts'],
      reporter: ['text-summary'],
      // calc logic is ~fully covered (branch 89); lines/funcs are held down by
      // entity zod-schema/vocab data. Floors just below current; raise as covered.
      thresholds: { statements: 68, branches: 85, functions: 75, lines: 68 },
    },
  },
});
