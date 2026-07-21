# In-app Survey Facilitation — implementation plan & handoff

**Status: COMPLETE.** Backend + respondent client (PR #1), practitioner campaign UI (PR #2),
campaign removal + view-only share (PR #5). Remaining hardening (rate-limiting, token expiry)
stays deferred until public hosting — see §C.

## Goal

Let a practitioner run the whole assessment loop *inside the app* instead of by
hand in Excel: send a survey to confirmed role-holders, let them fill it via a
link, and have the system aggregate the results onto the assessment
automatically (individual results + rolled-up score). Mirrors the existing
Proxima/Excel workflow, but the app does the aggregation.

## Decisions already made (don't relitigate without reason)

- **Recipients are role-holders only.** Identity comes from the `roles` roster
  (a recipient references `roles.id`); only roles that name a person are
  invitable. The app never surveys anonymous users or impacted-group
  populations. Fits sponsor/manager competency + role ADKAR.
- **Generate-don't-send.** The app produces per-recipient links; the
  practitioner emails them from their own client. No SMTP in the app.
- **Submit-once.** A respondent submits one final time; re-submit is refused
  (409). No cross-session draft persistence.
- **Non-destructive roll-up.** When submissions exist, aggregated survey
  responses *supersede* the practitioner's hand-entered responses for scoring,
  but nothing is stored — it's recomputed at read time (honours "derived values
  are never stored") and the hand-entered data reappears if the campaign is
  removed. **Notes are never overwritten.**
- **Licensing caveat is live.** Respondents see verbatim Prosci item wording.
  This mirrors the license holder's sanctioned professional workflow; it must
  not become a public/multi-tenant product. See CLAUDE.md.

## What's built

Commits (oldest→newest): `5a7db3b`, `ed24acd`, `97d91e7`, `a69dd51`, `000a47b`, `ad06cc9`.

1. **Domain aggregation** — `packages/domain/src/calc/aggregate.ts`
   `aggregateResponses(sets[])` → per-item `{ mean, answered, distribution }`;
   `mean` is shaped as a response map so it feeds the existing scorers.
2. **Tooling / client failure harness** — ESLint flat config wired into
   `npm run check`; `packages/client/src/lib/queryClient.ts` (`createQueryClient`
   extracted from `main.tsx`) + `packages/client/src/test/harness.tsx`
   (`renderWithClient`, `captureToasts`). Build client work test-first on this.
3. **Survey data model + practitioner API** — migration
   `005_surveys.sql` (`survey_campaigns`, `survey_recipients`,
   `survey_responses`), `packages/server/src/modules/surveys/*`,
   `newToken()` in `infra/db.ts`. `person_name` is snapshotted and
   `role_id` is `ON DELETE SET NULL` so removing a role never erases a
   submitted survey.
4. **Public capture endpoint** — `/api/survey/:token` (GET respondent view,
   PUT final submit), mounted outside the practitioner surface; exposes no
   project data.
5. **Roll-up wiring** — `assessments.service.present()` applies the survey
   override at the single assessment read choke point, so the dashboard,
   exports and roadmap all agree. `surveys.service.getAssessmentSurvey()` owns
   the aggregation.
6. **Respondent page** — `/s/:token`
   (`packages/client/src/features/surveys/`): chrome-less `SurveyPage`,
   `useSurvey`/`useSubmitSurvey`, driven by domain
   `surveyStructure(type)` (renderable items for any assessment type).

### API surface (all live)

- `POST /api/projects/:projectId/surveys` `{ assessmentId, roleIds[] }` → campaign + recipients (with tokens)
- `GET  /api/projects/:projectId/surveys` → campaign summaries (recipientCount, submittedCount)
- `GET  /api/surveys/:id` → campaign with recipients
- `GET  /api/survey/:token` → respondent view `{ personName, assessmentType, assessmentLabel, submitted, responses }`
- `PUT  /api/survey/:token` `{ [itemKey]: score }` → final submit (409 if already submitted)
- Assessment reads (`GET /api/assessments/:id`, project list) now carry an
  optional `survey` block `{ respondentCount, distribution, individuals[] }`
  and rolled-up `responses`/`computed` when submissions exist.

## What's left

### A. Practitioner campaign UI (the loop-closing piece)

Build client-only, test-first on the harness (`renderWithClient`). New feature
folder `packages/client/src/features/surveys/` already exists; add a
`useCampaigns.ts` hook (one-per-feature convention) over the endpoints above.

1. **Launch a campaign from an assessment.** On the assessment run page
   (`features/assessments/AssessmentRunPage.tsx`), add a "Send as survey"
   action: pick role-holders (reuse roles data via a roles hook) and
   `POST .../surveys`. Show the generated per-recipient links with copy buttons
   (generate-don't-send). Consider a CSV/`mailto` export of name+link.
2. **Watch progress.** List a project's campaigns with `submittedCount /
   recipientCount`; refresh (TanStack Query invalidation) so ticks update.
3. **Show results on the assessment.** When `assessment.survey` is present,
   render the rolled-up score (already in `computed`), the per-item
   `distribution`, and the `individuals[]` list (name + their computed score).
   The existing editors show `computed`; add a read view for the survey block.

Tests: hook + a component test per screen using `renderWithClient` and
`vi.spyOn(api, …)` (see `SurveyPage.test.tsx` for the pattern).

### B. View-only dashboard share (Phase 5, independent)

Per-project read-only share token → `/view/:token` client route rendering the
existing dashboard components read-only, backed by a narrow
`/api/share/:token` projection router exposing **only** dashboard-safe reads and
**no** mutation routes. Mirror the survey tokenized-link pattern.

### C. Deferred hardening (do before any public hosting)

- **Rate-limiting + token expiry** on `/api/survey/:token` and the share route.
  Intentionally omitted while single-user/local. Add `express-rate-limit` and an
  `expires_at` column (new migration) when the endpoints face the internet.

## Conventions reminder

- Server: router → service → repo; `db` injected from `app.ts`; throw
  `HttpError`/`notFound`. Domain math lives in `domain/calc`, imported by both
  sides. Never edit a shipped migration — add `006_*.sql`.
- Client: features talk to the server only through `lib/api` + their own
  `useX.ts` hook; shared presentational bits in `ui/`.
- `npm run check` (typecheck + lint + tests) must be green before every commit.
  Every behavioural change lands with a test at the right level.
