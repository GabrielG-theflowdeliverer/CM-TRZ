import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Retry once in CI only: absorbs occasional RTL timing flakes under load
    // without masking real failures (a genuine break fails both attempts).
    retry: process.env.CI ? 1 : 0,
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // Bootstrap/entry, type-only, and test-support files aren't unit targets.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test/**', 'src/lib/types.ts'],
      reporter: ['text-summary'],
      // Floors held just below current actuals (stmts/lines ~83, branches ~82,
      // funcs ~68) to lock in the page-test backfill and stop silent regression.
      // Ratchet up as coverage grows (see docs/test-coverage.md).
      thresholds: { statements: 81, branches: 82, functions: 67, lines: 81 },
    },
  },
} as never);
