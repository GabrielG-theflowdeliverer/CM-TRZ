# Production-Readiness Punch List

**Context.** The app is feature-complete against its roadmap, `npm run check` is green,
and the deploy pipeline (Fly single-tenant, auto-deploy on green CI) plus auth,
login rate-limiting, and token expiry are already built. This document tracks the
remaining work before a **hosted** instance may face real, named respondents.

**Scope reminder (non-negotiable).** Single-user Prosci license. The only valid
target is *one private, password-protected instance for the license holder*.
Never public, never multi-tenant. Nothing here changes that.

Status legend: ⬜ not started · 🟡 in progress · ✅ done

---

## 1. Security headers / `Referrer-Policy` — **blocker** · ✅

**Why.** Survey and share links carry the access **token in the URL**
(`/s/:token`, `/api/survey/:token`, `/api/share/:token`). With no `Referrer-Policy`,
any outbound navigation or third-party resource load from a token page can leak the
token in the `Referer` header. There are also no `X-Content-Type-Options`,
`X-Frame-Options`/CSP, or HSTS headers. This is the highest-value item.

**Plan (two increments — CSP is split out because it needs browser verification):**

- **1a — baseline headers (supertest-verifiable).** ✅
  Add `helmet` at the top of `createApp` so it covers both the API and the
  static SPA (same origin). Ship with `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options`/frameguard `DENY`,
  and HSTS. **CSP is disabled in this step** (helmet's default CSP breaks a
  Vite/SPA's inline styles) and tracked as 1b.
  *Acceptance:* a supertest asserts the headers are present on an API response
  and that no `Referer` policy gap remains; `npm run check` green.

- **1b — Content-Security-Policy.** ✅
  Conservative same-origin CSP tuned to the built client: `default-src 'self'`,
  `script-src 'self'` (no inline-JS escape hatch), `style-src 'self'
  'unsafe-inline'` (recharts sets inline `style=""` on SVG nodes),
  `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
  Verified in-browser (headless Chrome against the production server serving the
  built SPA): home page and a demo project's chart pages mount fully, recharts
  SVGs render, inline styles apply — nothing blocked. Header asserted in
  `test/security-headers.test.ts`.

## 2. Verified first deploy — **blocker** · 🟡 (runbook ready; deploy is the user's step)

**Why.** The pipeline is "ready" but unproven. Needs three secrets set
out-of-band (`CMT_SESSION_SECRET`, `CMT_EDITOR_PASSWORD_HASH`,
`FLY_DEPLOY_TOKEN`) and one successful `flyctl deploy` observed booting on the
volume, passing the `/api/health` check, and serving the SPA behind auth.

**Prep done:** the production runtime was verified locally (`npm start` serves
the built SPA, `/api/health` green, app mounts under CSP), and a full
step-by-step is written in **`docs/deploy-runbook.md`** (app create, volume,
secrets, `flyctl deploy --remote-only`, verify, CI token, rollback). The Docker
*image build* can't be run on the dev box (no Docker daemon); Fly builds it
remotely on first deploy — that deploy is the build test and needs the license
holder's Fly account. Parked here until you host.

*Acceptance:* a documented successful deploy; health endpoint green in prod;
login works; a survey token round-trips (checklist at the end of the runbook).

## 3. PII / data-handling posture — **high** · ✅

**Why.** The app now stores **named** self-assessments (person name snapshotted
on survey recipients + responses). That is personal data. Decide and document:
retention window, deletion path (data-subject erasure), and what leaves the box
(exports carry names).

**Done:** `docs/data-handling.md` documents the PII inventory, storage (SQLite +
backups), retention, all erasure paths, and export behaviour (roster names
travel in JSON/CSV export by design; survey PII never does). Added a **targeted
single-respondent erasure** path — `DELETE /api/survey-recipients/:id` (router →
service → repo, responses cascade) — so a data-subject can be removed without
nuking the whole campaign; the assessment roll-up recomputes over the remaining
respondents. Test-covered in `surveys.test.ts`.
*Note:* backups retain PII until they rotate out — a hard erasure also clears
`/data/backups` (documented).

## 4. Encryption at rest — **medium** · ✅

**Why.** The SQLite file on the Fly volume holds the PII above in plaintext.
Options: SQLCipher (better-sqlite3 build swap — non-trivial) vs. relying on Fly
volume encryption + tight access. Pick one deliberately.

**Done (decision + the one real gap closed):** on-volume DB + backups rely on
**Fly's default volume encryption** — SQLCipher rejected as YAGNI (key would live
on the same host; native-build + backup complexity for little marginal benefit).
The genuine exposure was the **weekly off-Fly backup**, which pulled a *plaintext*
PII database into a GitHub artifact for 90 days. `backup.yml` now **AES-256
encrypts it** (`openssl enc`, key = `BACKUP_ENCRYPTION_KEY` secret) before upload
and refuses to upload if the key is unset — so a plaintext DB can never leave the
encrypted volume. Decision + decrypt/restore documented in `docs/data-handling.md`;
secret setup in `docs/deploy-runbook.md`. The app's on-volume restore-drill test
is unaffected (on-volume backups stay plaintext on the encrypted volume).

## 5. End-to-end smoke test — **medium** · ✅

**Why.** Unit/integration coverage is strong, but the respondent→practitioner
journey (the one flow crossing the public boundary) has no full-stack test.

**Done:** Playwright smoke in `e2e/` drives the journey against the **production
server** (built SPA + API on one origin, auth off): seed a campaign via API →
respondent fills and submits the tokened `/s/:token` survey in the browser →
practitioner opens the assessment run and sees `1/1 submitted` with the
respondent marked Submitted. Run with `npm run e2e`. Wired as a **separate,
non-gating** CI job (`.github/workflows/e2e.yml`) — it installs a browser and
boots the app, so it stays off the required `check` gate (a signal, not a merge
blocker) and isn't named "CI" so it won't trigger the deploy workflow.

## 6. Observability — **medium** · ✅

**Why.** No structured logs or error aggregation. Fly restarts a dead process,
but a silent 500 loop is invisible.

**Done:** a dependency-free structured logger (`infra/log.ts`) emitting one JSON
line per event (stdout for info/warn, stderr for error), so `fly logs` stays
greppable. `requestLogger()` logs method/path/status/ms per completed request
(skipping the 30s health probe); the `errorHandler` now logs unexpected 500s
with request context (method/path/status/message/stack) — so a failure is
visible long after the client's 6s toast vanishes, without ever leaking the
stack to the client. Level is `CMT_LOG_LEVEL` (default `info`); a vitest setup
file sets `silent` to keep the suite quiet. Unit-tested in `test/log.test.ts`.
*Beyond scope (YAGNI for one instance):* shipping logs to an external
aggregator. `fly logs` + structured lines is the right altitude here.

## 7. Accessibility (WCAG) — **low** · ✅

Baseline pass on the practitioner UI and the respondent survey page.

**Done:** `@axe-core/playwright` scans (WCAG 2.0/2.1 A + AA) run in the e2e suite
(`e2e/a11y.spec.ts`) against the respondent survey page and the practitioner home
page, gating on **critical/serious** impact (the baseline floor). Fixed what they
flagged: the per-project status `<select>` now has an `aria-label` (was a
critical `select-name` violation), and muted text that failed AA contrast under
Tailwind v4's palette (`text-slate-400`, and `text-slate-500` on `bg-slate-100`
chips) was darkened to `slate-600` in `HomePage`, `SurveyPage`, and the shared
`BandChip`/`RiskBadge`. Both surfaces are now clean.

---

### Execution order
1 (blocker) → 2 (blocker) → 3 → 4 → 5 → 6 → 7.
Items 3–7 are independent and can reorder by appetite.
