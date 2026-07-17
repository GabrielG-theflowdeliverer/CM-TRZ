import { PCT_ASPECT_KEYS, PCT_FACTORS, pctItemKey, type PctAspectKey } from '../content/pctFactors.js';

/**
 * Traffic-light bands used across the workbook for PCT scores.
 * Excel conditional formatting: 24.5–30.5 green, 19.5–24.5 yellow, 9–19.5 red.
 */
export type ScoreBand = 'strength' | 'alert' | 'risk';

export const BAND_LABELS: Record<ScoreBand, string> = {
  strength: 'Strength - should be leveraged and maintained',
  alert: 'Alert/possible risk - needs further investigation',
  risk: 'High risk/threat - needs immediate action',
};

export function pctBand(score: number): ScoreBand {
  if (score >= 24.5) return 'strength';
  if (score >= 19.5) return 'alert';
  return 'risk';
}

/**
 * Aspect score: sum of the ten factor scores, but only once every factor is
 * answered — Excel: IF(COUNTIF(range,">0")=10, SUM(range), "").
 */
export function pctAspectScore(values: ReadonlyArray<number | null | undefined>): number | null {
  const answered = values.filter((v): v is number => typeof v === 'number' && v > 0);
  if (answered.length !== 10 || values.length !== 10) return null;
  return answered.reduce((a, b) => a + b, 0);
}

export interface PctScores {
  success: number | null;
  leadership: number | null;
  project_management: number | null;
  change_management: number | null;
}

/** Compute all four aspect scores from an item_key -> value response map. */
export function pctScores(responses: Readonly<Record<string, number | null>>): PctScores {
  const result = {} as Record<PctAspectKey, number | null>;
  for (const aspect of PCT_ASPECT_KEYS) {
    const values = PCT_FACTORS[aspect].map((_, i) => responses[pctItemKey(aspect, i)] ?? null);
    result[aspect] = pctAspectScore(values);
  }
  return result;
}
