import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end smoke against the *production* server: it serves the built SPA and
 * the API from one origin (no dev proxy), which is exactly how the app runs on
 * Fly. Auth is left off (no CMT_SESSION_SECRET/HASH) so the practitioner surface
 * is reachable without a login step — the journey under test is the survey flow,
 * not authentication.
 *
 * A single Chromium project keeps this a deterministic smoke, not a matrix.
 */
const PORT = 4599;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Run from the repo root; build the client, then start the server against a
    // throwaway absolute DB path (relative paths would resolve against the
    // server workspace's cwd, not root). Wipe it first so each run is clean.
    command:
      'rm -rf /tmp/cmt-e2e && npm run build -w @cmt/client && ' +
      'CMT_PORT=4599 CMT_DB_FILE=/tmp/cmt-e2e/e2e.db CMT_BACKUP_DIR=/tmp/cmt-e2e/backups ' +
      'npm run start -w @cmt/server',
    cwd: repoRoot,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
});
