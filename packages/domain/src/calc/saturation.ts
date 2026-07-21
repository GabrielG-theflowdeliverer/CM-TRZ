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

/** Disruption peaks around go-live: buckets within ±1 month weigh heavier. */
export const GOLIVE_WEIGHT = 1.5;

/** One project's load on a group for one month bucket. */
export function saturationLoad(
  degreeOfImpact: number | null,
  window: SaturationWindow | null,
  bucket: string,
  goliveDate: string | null,
): number {
  if (degreeOfImpact === null || window === null) return 0;
  if (bucket < monthOf(window.start) || bucket > monthOf(window.end)) return 0;
  const nearGolive =
    goliveDate !== null && Math.abs(monthIndex(bucket) - monthIndex(monthOf(goliveDate))) <= 1;
  return degreeOfImpact * (nearGolive ? GOLIVE_WEIGHT : 1);
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
