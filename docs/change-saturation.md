# Change-Saturation Portfolio Heatmap — product spec

**Status: BUILT** (migration landed as `008`, not `007` — the share token took that slot).
Implementation: `domain/calc/saturation.ts`, `server/modules/org-groups`,
`dashboard.service.getSaturation` + `GET /api/dashboard/saturation`,
`client/features/impact/OrgGroupLinker`, `client/features/dashboard/SaturationHeatmap`.

## Problem

Each project tracks its own impacted groups, but nobody can see the *sum*: how
much change a real-world group (Sales, Ops, Finance) is absorbing across every
active project at once. Over-saturated groups are where resistance, fatigue and
failed adoption concentrate — and today that risk is invisible until it bites.
This is a question Excel/Proxima structurally cannot answer and a flagship
enterprise capability for the Prosci conversation.

## The core design problem: group identity across projects

`impacted_groups` rows are project-scoped; "Sales Team" in two projects is two
unrelated rows. Saturation requires knowing they are the same people.

**Decision: an explicit, lightweight org-group registry with manual linking.**

- New table `org_groups` (`id`, `name`, `created_at`) — the real-world group.
- `impacted_groups` gains nullable `org_group_id REFERENCES org_groups(id)
  ON DELETE SET NULL` (additive migration `007`).
- Linking is **manual with assist**: when a practitioner creates/edits a
  project group, the UI suggests org groups by normalized-name match
  ("Sales Team" ≈ "sales team") and offers *link to existing* / *create new* /
  *leave unlinked*. No silent auto-matching — a wrong merge silently corrupts
  the heatmap, and the practitioner knows the org; the app doesn't.
- Unlinked project groups simply don't contribute to the heatmap (and the UI
  shows a "N unlinked groups" nudge so coverage is visible, not assumed).

Rejected alternatives: fuzzy name auto-matching (wrong merges are worse than
missing data); forcing every group to be org-registered (adds friction to the
single-project workflow that works today).

## Saturation model (domain/calc, derived — never stored)

A group's load from one project in a given time bucket:

```
load(group, project, bucket) =
  degreeOfImpact(group aspects)        // 1..5, existing calc — how hard it hits
  × active(project, bucket)            // 1 if bucket ∩ [kickoff, outcomes], else 0
  × phaseWeight(project, bucket)       // go-live proximity multiplier
```

- `active` uses the roadmap's `kickoff_date` → `outcomes_date` window (fall
  back to activity `start/finish` extents when roadmap dates are missing;
  contribute nothing if neither exists — no invented data).
- `phaseWeight` reflects that disruption peaks around go-live: e.g. 1.0
  baseline, 1.5 for buckets within ±1 month of `golive_date`. Exact curve is a
  named constant in `domain/calc/saturation.ts` with a spec, so it's tunable
  and testable, not folded into UI code.

**Saturation of an org group per bucket** = Σ load over all linked project
groups in non-completed projects.

**Bands** (traffic-light, consistent with existing score-band idiom):
`ok` / `elevated` / `overloaded` via thresholds in the calc module. Thresholds
are a judgment call — ship defaults, mark them clearly as heuristic, revisit
with real data. Do **not** present this as a Prosci-defined score (fidelity:
it's our analytic, not their methodology — label it as such in the UI).

New calc functions (each with boundary-case specs, per repo rule):
- `projectWindow(roadmap, activities) → {start, end} | null`
- `saturationLoad(degree, window, bucket, golive) → number`
- `saturationBand(score) → 'ok' | 'elevated' | 'overloaded'`

## API

- `GET /api/dashboard/saturation?from=YYYY-MM&to=YYYY-MM` (cross-project
  surface, lives in the dashboard module):
  rows = org groups, columns = month buckets, cells = `{score, band,
  contributions: [{projectId, projectName, load}]}`, plus
  `unlinkedGroupCount` for the coverage nudge.
- Org-group CRUD + linking:
  `GET/POST /api/org-groups`, and `org_group_id` accepted on the existing
  group update (extend `groupUpdateSchema`).

## UI

1. **Heatmap on the portfolio dashboard** — rows: org groups; columns: months
   (default: this month −1 to +6); cell color by band, number = score.
   Click a cell → contribution breakdown (which projects, how much each).
   This is the exec money-shot and the demo centerpiece.
2. **Linking affordance** on the project group editor (suggest/link/create).
3. **Coverage nudge** on the heatmap: "6 project groups aren't linked to an
   org group — link them to complete this view."

## Phasing (each independently shippable, test-first)

1. `domain/calc/saturation.ts` + specs (pure; proves the model).
2. Migration `007` + org-groups module (server, supertest incl. link/unlink
   and ON DELETE SET NULL preservation).
3. Saturation endpoint (folds calc over real data; supertest with a seeded
   two-project overlap scenario).
4. Linking UI on the group editor (RTL on the shared harness).
5. Heatmap component on the portfolio dashboard (RTL; then E2E later with the
   Playwright work from the hardening plan).

## Honest limits (state these in the UI, not just here)

- Saturation ≈ *scheduled exposure to impact*, not measured strain. It doesn't
  know about BAU workload, seasonality, or non-project change. It's a leading
  planning signal, not a wellbeing metric.
- Quality depends on linking coverage and roadmap dates being filled in —
  hence the visible coverage nudge rather than silent gaps.
