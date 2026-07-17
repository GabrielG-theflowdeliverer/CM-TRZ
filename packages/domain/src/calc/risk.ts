import { RISK_FACTORS, RISK_SECTION_KEYS, riskItemKey, type RiskSectionKey } from '../content/riskFactors.js';

export type RiskQuadrant = 'Low' | 'Medium' | 'High';

/**
 * Section score — Excel: IF(COUNTIF(range,">=1")=14, SUM(range), "NA").
 * Only produced once all fourteen factors are answered. Range 14–70.
 */
export function riskSectionScore(values: ReadonlyArray<number | null | undefined>): number | null {
  const answered = values.filter((v): v is number => typeof v === 'number' && v >= 1);
  if (answered.length !== 14 || values.length !== 14) return null;
  return answered.reduce((a, b) => a + b, 0);
}

/**
 * Risk quadrant — Excel:
 * IF(CC="NA","NA", IF(OA="NA","NA",
 *   IF(CC>=42, IF(OA>=42,"High","Medium"), IF(OA>=42,"Medium","Low"))))
 */
export function riskQuadrant(cc: number | null, oa: number | null): RiskQuadrant | null {
  if (cc == null || oa == null) return null;
  if (cc >= 42) return oa >= 42 ? 'High' : 'Medium';
  return oa >= 42 ? 'Medium' : 'Low';
}

export interface RiskScores {
  cc: number | null;
  oa: number | null;
  quadrant: RiskQuadrant | null;
}

/** Compute both section scores and the quadrant from an item_key -> value map. */
export function riskScores(responses: Readonly<Record<string, number | null>>): RiskScores {
  const sums = {} as Record<RiskSectionKey, number | null>;
  for (const section of RISK_SECTION_KEYS) {
    const values = RISK_FACTORS[section].map((_, i) => responses[riskItemKey(section, i)] ?? null);
    sums[section] = riskSectionScore(values);
  }
  return { cc: sums.cc, oa: sums.oa, quadrant: riskQuadrant(sums.cc, sums.oa) };
}
