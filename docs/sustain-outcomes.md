# Sustain Outcomes (Prosci Phase 3) — design & plan

**Status: COMPLETE** (PRs #17–#27). Phases 1–6 shipped — domain calc, server module
(migrations 009 objectives/metrics/measurements, 010 reinforcement), the Outcomes page,
the portfolio benefit-realization view, a dashboard-wide project filter, the per-project
and pooled (colour-by-project) readiness-vs-adoption correlation, and the Reinforcement
workspace. CM Performance + Adapt Actions were re-homed into the new Phase 3 nav section.
Transfer-of-ownership remains the one deferred (YAGNI) activity.

## Context

The app models Prosci's 3-Phase Process but only implements two phases — the nav has
**Phase 1 — Prepare Approach** and **Phase 2 — Manage Change**, and stops. **Phase 3 —
Sustain Outcomes is missing.** Two activities that belong to Phase 3 are currently
mis-filed under Phase 2: **CM Performance** ("document performance") and **Adapt Actions**
("corrective action").

This feature adds Phase 3 and, with it, the highest-value analytic in the product:
**Outcomes / benefit realization** — turning the qualitative "define success + adoption %
target" the app already captures into a *measured* object, and closing the loop from the
leading CM signals we already track (ADKAR, PCT, sponsor effectiveness) to lagging
adoption and business benefit.

## Structure

Add **Phase 3 — Sustain Outcomes** as the third nav section (mirroring Phases 1 & 2):

| Prosci Phase-3 activity | App page |
|---|---|
| Review / document performance | **Outcomes** (new): adoption + benefit metrics, realization, leading→lagging correlation |
| Activate sustainment (reinforcement) | **Reinforcement & Sustainment** (new); **Adapt Actions moves here** |
| Document performance | **CM Performance** moves here from Phase 2 |
| Transfer ownership | Lightweight checklist — deferred (YAGNI for v1) |

Outcomes and reinforcement are a **loop**: Outcomes surfaces where adoption/benefit is
slipping → ADKAR's Reinforcement element + the correlation panel explain it → Reinforcement
is where you act. (No users yet, so re-homing CM Performance / Adapt Actions is a clean move.)

## Outcomes data model (derived values never stored — recompute from raw, per repo rule)

- **Objective** — a defined success statement at a level (`organization` / `initiative` /
  `individual`), on the project. Extends Define Success (the 4 P's stay as narrative).
- **Metric** — a measurable KPI on an objective, two families:
  - **adoption** — Prosci's three (`speed` / `utilization` / `proficiency`), scoped per
    impacted group, measured against the group's `adoption_usage_definition`.
  - **benefit** — a business KPI with `baseline`, `target`, `unit`, `direction`.
- **Measurement** — a timestamped raw reading of a metric (the `survey_responses` analog).
  Realization %, adoption curves and rollups all recompute from these.

## Reuse (don't reinvent)
- Define Success already captures an **adoption % target** as free text (`useDoc`
  `define_success`, `adoption_percentage`) — becomes the first structured objective/target.
- Groups carry **`adoption_usage_definition`** — the per-group yardstick.
- Roadmap **kickoff / go-live / outcomes** dates — the measurement cadence (baseline →
  go-live → outcomes).
- **Surveys** (already built) — the collection channel for adoption/proficiency self-reports.
- Assessments (PCT / ADKAR / sponsor) — the leading indicators to correlate against.
- `domain/calc` + never-store-derived — same pattern as `saturation` / `aggregate`.

## Phasing (each an independently shippable PR, test-first)
1. **Domain foundation** *(this PR)* — `entities/outcomes.ts` + `calc/outcomes.ts`
   (benefit-realization %, latest measurement, rollup) with boundary specs.
2. **Server module** — migration (`objectives` / `metrics` / `measurements`), router→service→repo.
3. **Phase-3 nav section + re-home** CM Performance & Adapt Actions from Phase 2.
4. **Outcomes UI** — define objectives/metrics, enter measurements, realization gauges +
   adoption curves.
5. **Correlation / attribution panel** — leading indicators vs adoption/benefit per group.
6. **Reinforcement & Sustainment** workspace (Adapt Actions rehomed + reinforcement mechanisms).

## Honest tensions (design around these)
- **Correlation ≠ causation** — present attribution as directional insight, never a causal claim.
- **Measurement burden is the #1 killer** — lean on surveys + integrations; keep manual entry light.
- **Distinct from CM Performance** — CM-perf = "is the CM effort healthy?"; Outcomes = "did the
  change land?" Different axes; the UI must not blur them.

## Verification
`npm run check` green (typecheck + lint + coverage thresholds). Domain calc lands with a
boundary-case spec (repo rule for new `domain/calc` functions).
