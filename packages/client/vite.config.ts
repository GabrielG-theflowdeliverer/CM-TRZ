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
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // Bootstrap/entry, type-only, and test-support files aren't unit targets.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/test/**', 'src/lib/types.ts'],
      reporter: ['text-summary'],
      // The weak layer (many legacy pages untested). Floors just below current;
      // ratchet up ~5 points per page-test backfill PR (see docs/test-coverage.md).
      thresholds: { statements: 52, branches: 80, functions: 60, lines: 52 },
    },
  },
} as never);
