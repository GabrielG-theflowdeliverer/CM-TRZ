import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    // No retry. The CI-only retry that used to sit here absorbed a supertest
    // ECONNRESET caused by the harness starting an ephemeral server per
    // request; the harness now holds one server per test (see test/harness.ts)
    // and the suite ran 50/50 clean locally against a ~1-in-10 failure rate
    // before. A retry now would only hide the next real intermittent bug.
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      // CLI entrypoints are thin process bootstraps over already-tested logic
      // (index.ts = listen/shutdown; the *-cli / hash-password / online-backup
      // scripts just wire argv/env to it); migrations are SQL.
      exclude: [
        'src/index.ts',
        'src/backup-cli.ts',
        'src/hash-password.ts',
        'src/online-backup.ts',
        'src/seed-demo.ts',
        'src/infra/migrations/**',
        '**/*.test.ts',
      ],
      reporter: ['text-summary'],
      // Floors set just below current (lines 94 / branch 83 / funcs 93); raise as coverage grows.
      thresholds: { statements: 92, branches: 80, functions: 90, lines: 92 },
    },
  },
});
