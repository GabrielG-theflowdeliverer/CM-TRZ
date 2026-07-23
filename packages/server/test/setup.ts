// Keep the suite output clean: the request logger and error logger would
// otherwise print a JSON line per request. Individual tests that assert on
// logging override this locally.
process.env.CMT_LOG_LEVEL = 'silent';
