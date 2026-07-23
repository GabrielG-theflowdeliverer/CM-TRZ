import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
        'src/infra/migrations/**',
        '**/*.test.ts',
      ],
      reporter: ['text-summary'],
      // Floors set just below current (lines 94 / branch 83 / funcs 93); raise as coverage grows.
      thresholds: { statements: 92, branches: 80, functions: 90, lines: 92 },
    },
  },
});
