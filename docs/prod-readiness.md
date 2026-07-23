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

## 3. PII / data-handling posture — **high** · ⬜

**Why.** The app now stores **named** self-assessments (person name snapshotted
on survey recipients + responses). That is personal data. Decide and document:
retention window, deletion path (data-subject erasure), and what leaves the box
(exports carry names). This is a decision + light implementation, not a big build.
*Acceptance:* a short data-handling note in the repo; a way to purge a named
respondent's data; export behaviour re: names is deliberate and documented.

## 4. Encryption at rest — **medium** · ⬜

**Why.** The SQLite file on the Fly volume holds the PII above in plaintext.
Options: SQLCipher (better-sqlite3 build swap — non-trivial) vs. relying on Fly
volume encryption + tight access. Pick one deliberately.
*Acceptance:* a documented decision; if implemented, a restore drill still passes.

## 5. End-to-end smoke test — **medium** · ⬜

**Why.** Unit/integration coverage is strong, but the respondent→practitioner
journey (the one flow crossing the public boundary) has no full-stack test.
*Acceptance:* one Playwright journey — practitioner opens a campaign → respondent
submits via token → aggregated result appears on the assessment.

## 6. Observability — **medium** · ⬜

**Why.** No structured logs or error aggregation. Fly restarts a dead process,
but a silent 500 loop is invisible.
*Acceptance:* structured request/error logging; a way to see errors after the
6-second client toast has vanished.

## 7. Accessibility (WCAG) — **low** · ⬜

Baseline pass on the practitioner UI and the respondent survey page.

---

### Execution order
1 (blocker) → 2 (blocker) → 3 → 4 → 5 → 6 → 7.
Items 3–7 are independent and can reorder by appetite.
