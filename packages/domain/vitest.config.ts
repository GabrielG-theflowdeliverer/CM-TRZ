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
      // calc/ — the Excel-parity maths — is now fully covered: 100% statements
      // and functions, 94 branch. The package-wide numbers are held down by
      // entity zod-schema/vocab declarations, which the server integration
      // tests exercise instead. Floors just below current; raise as covered.
      thresholds: { statements: 71, branches: 90, functions: 80, lines: 71 },
    },
  },
});
