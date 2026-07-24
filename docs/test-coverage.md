# Test Coverage — state & plan to make it excellent

**Status:** measured baseline recorded; work not started. Handoff for the next engineer.

## Why this doc

`npm run check` is green at ~204 tests and the CI gate enforces it, but coverage is
**two-tier**: the backend and business logic are excellent; the client is thin and
uneven. This is the plan to make coverage genuinely excellent *and* enforced, so it
can't regress.

## Measured baseline (v8, all source files)

Run per package: `cd packages/<pkg> && npx vitest run --coverage --coverage.provider=v8 --coverage.reporter=text`
(coverage tooling is **not installed** — use `npm install --no-save @vitest/coverage-v8@^3` to measure, or install it for real per step 1 below).

| Package | Lines | Branch | Funcs | Read |
|---|---|---|---|---|
| server | 92.8% | 83% | 92.8% | Excellent — supertest hits nearly every route/service/invariant |
| domain | 73.4% | 89.9% | 82% | Logic excellent; `calc/` ~fully covered. The 73% lines is dragged down by `content/` **data constants** (verbatim Prosci text ~83%) — data, not logic. Branch 90% is the real signal. |
| client | **32%** | 83% | 58% | **Weak.** Most page components untested (written before the test harness existed). |

**Do not "fix" domain content coverage** — those are static verbatim data files; testing every string is noise.

## The plan

### 1. Wire coverage into CI with floors (do first — cheap, stops regression)
- Add `@vitest/coverage-v8` as a real devDependency.
- Add a `coverage` config to each package's `vitest`/`vite` config with `provider: 'v8'` and per-package thresholds set **just below current** so the floor holds today and ratchets up:
  - server: lines 90 / branch 80 / funcs 90
  - domain: **exclude `src/content/**` from coverage**, then set lines 90 / branch 85 (the calc logic easily clears this)
  - client: start at lines 30 / funcs 55, and **raise by ~5 points per backfill PR**
- Add a `coverage` npm script and run it in `.github/workflows/ci.yml` (either replace `npm run check`'s test step or add a job). Keep it a required check.

### 2. Backfill the high-risk client pages (in priority order)
17 client files sit at 0%. **Prioritise pages with real branching/logic; skip static content pages.**

**High value (real logic — do these):**
- `features/assessments/AssessmentRunPage.tsx` + editors (`PctEditor`, `RiskEditor`, `CompetencyEditor`, `AdkarEditor`) — scoring UI, the app's core
- `features/impact/GroupDetailPage.tsx` — tabs, aspects, ADKAR, linked roles/resistance (dense logic)
- `features/roadmap/RoadmapPage.tsx` — date editing, sequential/iterative modes, milestones
- `features/tracking/CmPerformancePage.tsx`, `TrackingPage.tsx`
- `features/plans/PlanDetailPage.tsx`, `features/blueprints/BlueprintDetailPage.tsx`
- `features/assessments/AssessmentsHubPage.tsx` (PCT trend + run creation)

**Low value (mostly render verbatim content — skip or one smoke test each):**
- `features/docs/*` (WhyCmPage, ResourcesPage, DefineSuccessPage, ResistancePage), `features/reference/ReferencePage.tsx`, `HomePage.tsx`

**Feature areas with ZERO tests today:** assessments (6 pages), tracking (4), docs (5), impact (3), blueprints (2), plans (2), projects (2), roadmap, roles, reference.

### Test pattern to follow (already established)
- Render with the shared harness `renderWithClient` (`src/test/harness.tsx`) — it wraps the real `QueryClient` so error→toast behaviour is exercised.
- Mock the network at the `api` helper: `vi.spyOn(api, 'get'|'put'|'post'|'del')`. Route by URL for pages that make several calls (see `AssessmentSurveyPanel.test.tsx` `mockGet`).
- For routed pages, wrap in `MemoryRouter` (see `share.test.tsx`, `SurveyPage.test.tsx`).
- Assert behaviour and the design-for-failure paths (loading, error toast, disabled-while-pending), not markup.
- Good exemplars: `RescheduleDialog.test.tsx`, `share.test.tsx`, `SaturationHeatmap.test.tsx`.

### Optional, higher up the hardening list
End-to-end (Playwright) for the cross-browser survey journey (respondent submits → practitioner sees roll-up) — unit/component tests can't cover that path. Tracked in the broader hardening notes, not required for "excellent unit coverage."

## Definition of done
- `@vitest/coverage-v8` installed; per-package thresholds enforced in CI (required check).
- `content/**` excluded from domain coverage.
- Client line coverage raised from ~60% to **~83%** (stmts/lines) by backfilling the high-value pages; floors ratcheted to just below current (stmts/lines 81, branches 82, funcs 67) to lock the gains in. Functions (~68%) stays the weak metric — the next lever is testing the remaining 0%-covered surfaces (e.g. `WhyCmPage`, `DocHeader`, `useDoc`).
- Server and domain-logic floors held at ≥90% lines / ≥85% branch.
- Both suites retry once **in CI only** (`retry: process.env.CI ? 1 : 0`) to absorb infra flakes (supertest `socket hang up`, RTL timing under load) without masking real breaks.
