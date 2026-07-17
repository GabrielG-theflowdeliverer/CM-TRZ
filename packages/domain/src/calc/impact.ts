/**
 * Define Impact calculations (DI1 sheet).
 */

/** Excel: COUNTIF(G14:G23,">0") — number of aspects with impact greater than zero. */
export function aspectsImpacted(impacts: ReadonlyArray<number | null | undefined>): number {
  return impacts.filter((v): v is number => typeof v === 'number' && v > 0).length;
}

/**
 * Excel: IF(count>0, SUM(G14:G23)/count, "") — the mean impact across only the
 * impacted (non-zero) aspects. Zero-rated aspects are deliberately excluded:
 * impacted individuals don't perceive the aspects that aren't affected.
 */
export function degreeOfImpact(impacts: ReadonlyArray<number | null | undefined>): number | null {
  const count = aspectsImpacted(impacts);
  if (count === 0) return null;
  const sum = impacts.reduce<number>((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
  return sum / count;
}
