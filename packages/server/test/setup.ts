import { afterEach } from 'vitest';
import { closeTestApps } from './harness.js';

// Keep the suite output clean: the request logger and error logger would
// otherwise print a JSON line per request. Individual tests that assert on
// logging override this locally.
process.env.CMT_LOG_LEVEL = 'silent';

// Test apps now hold a listening socket for the whole test (see harness.ts), so
// they have to be handed back. Doing it here rather than per file keeps the ~20
// suites that call createTestApp() free of teardown they would have to remember.
afterEach(closeTestApps);
