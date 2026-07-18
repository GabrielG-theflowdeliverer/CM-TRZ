/**
 * Multi-respondent aggregation.
 *
 * A single assessment response map is `item_key -> value`. When several people
 * each fill the same survey we hold one such map per respondent and roll them
 * up here. The `mean` output is itself an `item_key -> value` map, so it feeds
 * straight into the existing per-type scorers (`pctScores`,
 * `adkarScoresFromResponses`, `riskScores`, `competencyTotal`) — aggregation
 * reuses all existing scoring rather than reimplementing it.
 *
 * Nothing here is stored: like every derived value in this repo, an aggregate
 * is recomputed from the raw respondent maps on read.
 */

/** Roll-up for a single item across all respondents. */
export interface ItemAggregate {
  /** Mean of answered values; null when no respondent answered this item. */
  mean: number | null;
  /** How many respondents answered this item (null answers don't count). */
  answered: number;
  /** Histogram: score value -> number of respondents who gave it. */
  distribution: Record<number, number>;
}

export interface ResponseAggregate {
  /**
   * Per item-key mean of answered responses, null when no one answered it.
   * Shaped as a response map so it drops into the single-response scorers.
   *
   * Note: an aspect/total computed from these means is the sum of per-item
   * means, i.e. the expected aggregate score — it only equals the mean of each
   * respondent's own total when everyone answered every item.
   */
  mean: Record<string, number | null>;
  /** Per item-key detail for distribution dashboards. */
  byKey: Record<string, ItemAggregate>;
  /** Number of respondent maps folded in (including any who left items blank). */
  respondents: number;
}

/** Fold many respondent response maps into per-item means + distributions. */
export function aggregateResponses(
  responseSets: ReadonlyArray<Readonly<Record<string, number | null>>>,
): ResponseAggregate {
  const byKey: Record<string, ItemAggregate> = {};
  const sums: Record<string, number> = {};

  for (const set of responseSets) {
    for (const [key, value] of Object.entries(set)) {
      if (value == null) continue; // an unanswered item is indistinguishable from an absent one
      const item = (byKey[key] ??= { mean: null, answered: 0, distribution: {} });
      item.answered += 1;
      item.distribution[value] = (item.distribution[value] ?? 0) + 1;
      sums[key] = (sums[key] ?? 0) + value;
    }
  }

  const mean: Record<string, number | null> = {};
  for (const [key, item] of Object.entries(byKey)) {
    // A key lives in `byKey` only after a non-null value landed, so `sums[key]`
    // is always present here; `?? 0` just satisfies the strict index check.
    item.mean = item.answered > 0 ? (sums[key] ?? 0) / item.answered : null;
    mean[key] = item.mean;
  }

  return { mean, byKey, respondents: responseSets.length };
}
