import { describe, expect, it } from 'vitest';
import { surveyStructure } from './surveyStructure.js';
import { ASSESSMENT_TYPES, ITEM_KEYS_BY_TYPE, SCORE_RANGE_BY_TYPE } from '../entities/assessment.js';

describe('surveyStructure', () => {
  it.each(ASSESSMENT_TYPES)('covers exactly the item keys for %s, in order', (type) => {
    const keys = surveyStructure(type).groups.flatMap((g) => g.items.map((i) => i.key));
    expect(keys).toEqual([...ITEM_KEYS_BY_TYPE[type]]);
  });

  it.each(ASSESSMENT_TYPES)('reports the score range for %s', (type) => {
    const { min, max } = surveyStructure(type);
    expect({ min, max }).toEqual(SCORE_RANGE_BY_TYPE[type]);
  });

  it.each(ASSESSMENT_TYPES)('labels every item and titles every group for %s', (type) => {
    for (const group of surveyStructure(type).groups) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.items.length).toBeGreaterThan(0);
      for (const item of group.items) expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
