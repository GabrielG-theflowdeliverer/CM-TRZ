import { type AssessmentType, SCORE_RANGE_BY_TYPE } from '../entities/assessment.js';
import { PCT_ASPECT_KEYS, PCT_ASPECT_LABELS, PCT_FACTORS, pctItemKey } from './pctFactors.js';
import { RISK_FACTORS, RISK_SECTION_KEYS, RISK_SECTION_LABELS, riskItemKey } from './riskFactors.js';
import { ADKAR_ELEMENTS, ADKAR_LABELS, ADKAR_STATEMENTS, adkarItemKey } from './adkar.js';
import {
  MANAGER_COMPETENCY_SECTIONS,
  SPONSOR_COMPETENCY_SECTIONS,
  competencyItemKey,
} from './competencyItems.js';

/**
 * Renderable structure of an assessment's items — labelled questions grouped
 * into sections, with the valid score range. Derived from the same verbatim
 * content constants the practitioner editors use, so a survey and the editor
 * always show identical wording and keys. Used to render the respondent-facing
 * survey form generically for any assessment type.
 */
export interface SurveyItem {
  key: string;
  label: string;
}
export interface SurveyGroup {
  title: string;
  items: SurveyItem[];
}
export interface SurveyStructure {
  groups: SurveyGroup[];
  min: number;
  max: number;
}

export function surveyStructure(type: AssessmentType): SurveyStructure {
  const { min, max } = SCORE_RANGE_BY_TYPE[type];
  return { groups: groupsFor(type), min, max };
}

function groupsFor(type: AssessmentType): SurveyGroup[] {
  switch (type) {
    case 'pct':
      return PCT_ASPECT_KEYS.map((aspect) => ({
        title: PCT_ASPECT_LABELS[aspect],
        items: PCT_FACTORS[aspect].map((label, i) => ({ key: pctItemKey(aspect, i), label })),
      }));
    case 'risk':
      return RISK_SECTION_KEYS.map((section) => ({
        title: RISK_SECTION_LABELS[section],
        items: RISK_FACTORS[section].map((f, i) => ({ key: riskItemKey(section, i), label: f.factor })),
      }));
    case 'adkar':
      return [
        {
          title: 'ADKAR',
          items: ADKAR_ELEMENTS.map((el) => ({
            key: adkarItemKey(el),
            label: `${ADKAR_LABELS[el]} — ${ADKAR_STATEMENTS[el]}`,
          })),
        },
      ];
    case 'sponsor_competency':
      return SPONSOR_COMPETENCY_SECTIONS.map((s) => ({
        title: s.title,
        items: s.items.map((label, i) => ({ key: competencyItemKey('sponsor', s.key, i), label })),
      }));
    case 'manager_competency':
      return MANAGER_COMPETENCY_SECTIONS.map((s) => ({
        title: s.title,
        items: s.items.map((label, i) => ({ key: competencyItemKey('manager', s.key, i), label })),
      }));
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown assessment type: ${String(_exhaustive)}`);
    }
  }
}
