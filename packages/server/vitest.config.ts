import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      // index.ts is the process bootstrap (listen/shutdown); migrations are SQL.
      exclude: ['src/index.ts', 'src/infra/migrations/**', '**/*.test.ts'],
      reporter: ['text-summary'],
      // Floors set just below current (lines 94 / branch 83 / funcs 93); raise as coverage grows.
      thresholds: { statements: 92, branches: 80, functions: 90, lines: 92 },
    },
  },
});
