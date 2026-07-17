/**
 * Sponsor / Manager Competency Assessment calculations (SpComp, MgrComp sheets).
 */

export type SponsorInterpretation = 'Excellent' | 'Good' | 'Fair to Poor';

/** Excel: SUM over the item range — blanks contribute nothing. Total out of 100. */
export function competencyTotal(values: ReadonlyArray<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
}

/** Score interpretation: 80-100 = Excellent; 70-79 = Good; 69 and below = Fair to Poor. */
export function sponsorInterpretation(total: number): SponsorInterpretation {
  if (total >= 80) return 'Excellent';
  if (total >= 70) return 'Good';
  return 'Fair to Poor';
}
