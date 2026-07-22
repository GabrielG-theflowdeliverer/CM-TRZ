/**
 * Change saturation: how much scheduled change a real-world (org) group is
 * absorbing across all active projects in a given month. NOTE: this is our
 * analytic, not a Prosci-defined score — it measures scheduled exposure to
 * impact, not experienced strain — and the UI labels it as such.
 *
 * load(group, project, month) =
 *   degreeOfImpact × active(project window ∋ month) × phaseWeight(go-live ±1mo)
 * saturation(org group, month) = Σ load over linked project groups.
 */

export interface SaturationWindow {
  /** ISO dates (yyyy-mm-dd); the project exerts change between them, inclusive. */
  start: string;
  end: string;
}

/**
 * When a project exerts change: roadmap kickoff → outcomes (falling back to
 * go-live as the end), with activity date extents filling either missing side.
 * Null — contributing nothing — when a side can't be established: no invented
 * windows.
 */
export function projectWindow(
  roadmap: { kickoffDate: string | null; goliveDate: string | null; outcomesDate: string | null },
  activityDates: ReadonlyArray<{ startDate: string | null; finishDate: string | null }>,
): SaturationWindow | null {
  const activityBounds = activityDates
    .flatMap((a) => [a.startDate, a.finishDate])
    .filter((d): d is string => d !== null)
    .sort();
  const start = roadmap.kickoffDate ?? activityBounds[0] ?? null;
  const end = roadmap.outcomesDate ?? roadmap.goliveDate ?? activityBounds.at(-1) ?? null;
  if (start === null || end === null || end < start) return null;
  return { start, end };
}

/** 'yyyy-mm-dd' (or any ISO datetime) -> 'yyyy-mm' bucket. */
export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/** Inclusive list of 'yyyy-mm' buckets between two months. */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split('-').map(Number) as [number, number];
  while (true) {
    const bucket = `${year}-${String(month).padStart(2, '0')}`;
    if (bucket > to) break;
    months.push(bucket);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function monthIndex(bucket: string): number {
  const [year, month] = bucket.split('-').map(Number) as [number, number];
  return year * 12 + (month - 1);
}

/** Shift a 'yyyy-mm' bucket by a whole number of months. */
export function shiftMonth(bucket: string, by: number): string {
  const index = monthIndex(bucket) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Shift a full 'yyyy-mm-dd' date by N whole months, clamping the day to the
 * target month's length (Jan 31 + 1 month -> Feb 28). Used to turn a month-level
 * what-if shift into concrete new roadmap dates.
 */
export function shiftDateByMonths(iso: string, by: number): string {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  const index = year * 12 + (month - 1) + by;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last of this
  const d = Math.min(day, lastDay);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Disruption peaks around go-live: buckets within ±1 month weigh heavier. */
export const GOLIVE_WEIGHT = 1.5;

/** One project's load on a group for one month bucket — the core rule, at month granularity. */
export function monthLoad(
  degreeOfImpact: number | null,
  startMonth: string | null,
  endMonth: string | null,
  bucket: string,
  goliveMonth: string | null,
): number {
  if (degreeOfImpact === null || startMonth === null || endMonth === null) return 0;
  if (bucket < startMonth || bucket > endMonth) return 0;
  const nearGolive = goliveMonth !== null && Math.abs(monthIndex(bucket) - monthIndex(goliveMonth)) <= 1;
  return degreeOfImpact * (nearGolive ? GOLIVE_WEIGHT : 1);
}

/** As `monthLoad`, from an ISO-date window (used server-side from roadmap dates). */
export function saturationLoad(
  degreeOfImpact: number | null,
  window: SaturationWindow | null,
  bucket: string,
  goliveDate: string | null,
): number {
  return monthLoad(
    degreeOfImpact,
    window ? monthOf(window.start) : null,
    window ? monthOf(window.end) : null,
    bucket,
    goliveDate ? monthOf(goliveDate) : null,
  );
}

export type SaturationBand = 'ok' | 'elevated' | 'overloaded';

/**
 * Heuristic default thresholds (degree of impact is 1–5 per project): one
 * heavy project near go-live reads elevated; two heavy concurrent projects
 * read overloaded. Revisit against real portfolio data.
 */
export const SATURATION_THRESHOLDS = { elevated: 5, overloaded: 9 } as const;

export function saturationBand(score: number): SaturationBand {
  if (score >= SATURATION_THRESHOLDS.overloaded) return 'overloaded';
  if (score >= SATURATION_THRESHOLDS.elevated) return 'elevated';
  return 'ok';
}

/**
 * A project reduced to what the heatmap needs — its month window, go-live
 * month, and per-org-group degree of impact. Month-based so the whole grid can
 * be recomputed cheaply (e.g. a client "what-if" that shifts a go-live).
 */
export interface SaturationProject {
  id: string;
  name: string;
  startMonth: string | null;
  endMonth: string | null;
  goliveMonth: string | null;
  groups: Array<{ orgGroupId: string; degree: number | null }>;
}

export interface SaturationGridCell {
  score: number;
  band: SaturationBand;
  contributions: Array<{ projectId: string; projectName: string; load: number }>;
}

export interface SaturationGridRow {
  orgGroupId: string;
  orgGroupName: string;
  cells: SaturationGridCell[];
}

/**
 * Assemble the heatmap: for each org group and month, the summed load from
 * every project whose linked groups it represents. `shifts` moves a project's
 * whole window and go-live by N months — the same code powers the server's
 * live view (no shifts) and the client's what-if re-sequencing.
 */
export function buildSaturationRows(
  months: string[],
  orgGroups: ReadonlyArray<{ id: string; name: string }>,
  projects: ReadonlyArray<SaturationProject>,
  shifts: Readonly<Record<string, number>> = {},
): SaturationGridRow[] {
  return orgGroups.map((orgGroup) => ({
    orgGroupId: orgGroup.id,
    orgGroupName: orgGroup.name,
    cells: months.map((bucket) => {
      const contributions: SaturationGridCell['contributions'] = [];
      for (const project of projects) {
        const by = shifts[project.id] ?? 0;
        const start = project.startMonth === null ? null : shiftMonth(project.startMonth, by);
        const end = project.endMonth === null ? null : shiftMonth(project.endMonth, by);
        const golive = project.goliveMonth === null ? null : shiftMonth(project.goliveMonth, by);
        let load = 0;
        for (const g of project.groups) {
          if (g.orgGroupId === orgGroup.id) load += monthLoad(g.degree, start, end, bucket, golive);
        }
        if (load > 0) contributions.push({ projectId: project.id, projectName: project.name, load });
      }
      const score = contributions.reduce((sum, c) => sum + c.load, 0);
      return { score, band: saturationBand(score), contributions };
    }),
  }));
}
