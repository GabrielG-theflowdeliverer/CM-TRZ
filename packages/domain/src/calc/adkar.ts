import { ADKAR_ELEMENTS, ADKAR_LABELS, type AdkarElement, adkarItemKey } from '../content/adkar.js';

export type AdkarScores = Partial<Record<AdkarElement, number | null>>;

export type BarrierPoint = 'Awareness' | 'Desire' | 'Knowledge' | 'Ability' | 'Reinforcement' | 'No barrier';

/**
 * Barrier point — Excel:
 * IF(A="","", IF(A<=3,"Awareness", IF(D<=3,"Desire", IF(K<=3,"Knowledge",
 * IF(Ab<=3,"Ability", IF(R<=3,"Reinforcement","No barrier"))))))
 *
 * Notes on Excel semantics preserved here:
 * - If Awareness is unanswered, the result is blank (null).
 * - An unanswered later element compares as "not <= 3" (Excel text vs number),
 *   so the chain continues past it; if nothing scores <= 3, "No barrier".
 */
export function barrierPoint(scores: AdkarScores): BarrierPoint | null {
  const awareness = scores.awareness;
  if (awareness == null) return null;
  for (const element of ADKAR_ELEMENTS) {
    const value = scores[element];
    if (value != null && value <= 3) return ADKAR_LABELS[element] as BarrierPoint;
  }
  return 'No barrier';
}

/** Extract ADKAR scores from an item_key -> value response map. */
export function adkarScoresFromResponses(responses: Readonly<Record<string, number | null>>): AdkarScores {
  const scores: AdkarScores = {};
  for (const element of ADKAR_ELEMENTS) {
    scores[element] = responses[adkarItemKey(element)] ?? null;
  }
  return scores;
}
