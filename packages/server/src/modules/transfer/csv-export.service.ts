import {
  ADKAR_LABELS,
  ASSESSMENT_TYPE_LABELS,
  type AdkarElement,
  type AssessmentType,
} from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { toCsv } from '../../infra/csv.js';
import { HttpError } from '../../infra/http.js';
import * as projects from '../projects/projects.service.js';
import * as impact from '../impact/impact.service.js';
import * as roles from '../roles/roles.service.js';
import * as activities from '../activities/activities.service.js';
import * as assessments from '../assessments/assessments.service.js';

export const CSV_DATASETS = ['groups', 'roles', 'activities', 'assessments'] as const;
export type CsvDataset = (typeof CSV_DATASETS)[number];

function groupsCsv(db: Db, projectId: string): string {
  const groups = impact.listGroups(db, projectId);
  return toCsv(
    ['Impacted Group', 'Number in Group', 'Tags', 'Aspects Impacted', 'Degree of Impact', 'ADKAR Barrier Point', 'Group Risk'],
    groups.map((g) => [
      g.name,
      g.numPeople,
      g.tags.join('; '),
      g.computed.aspectsImpacted,
      g.computed.degreeOfImpact,
      g.computed.barrierPoint,
      g.computed.risk?.quadrant ?? '',
    ]),
  );
}

function rolesCsv(db: Db, projectId: string): string {
  const list = roles.listRoles(db, projectId);
  const groupName = new Map(impact.listGroups(db, projectId).map((g) => [g.id, g.name]));
  return toCsv(
    ['Roster', 'Role Name', 'Person', 'Impacted Groups', 'Support', 'Influence', 'Barrier Point', 'Activation Tactics'],
    list.map((r) => [
      r.roster,
      r.roleName,
      r.personName,
      r.groupIds.map((id) => groupName.get(id) ?? '').join('; '),
      r.support,
      r.influence,
      r.computed.barrierPoint,
      r.activationTactics,
    ]),
  );
}

function activitiesCsv(db: Db, projectId: string): string {
  const list = activities.listActivities(db, projectId);
  const groupName = new Map(impact.listGroups(db, projectId).map((g) => [g.id, g.name]));
  return toCsv(
    ['Activity Name', 'ADKAR Outcomes', 'Impacted Groups', 'Overall', 'Responsible', 'Start Date', 'Finish Date', 'Status'],
    list.map((a) => [
      a.name,
      a.adkarOutcomes.map((e) => ADKAR_LABELS[e as AdkarElement] ?? e).join('; '),
      a.groupIds.map((id) => groupName.get(id) ?? '').join('; '),
      a.overall ? 'Yes' : 'No',
      a.responsible,
      a.startDate,
      a.finishDate,
      a.status,
    ]),
  );
}

function assessmentsCsv(db: Db, projectId: string): string {
  const list = assessments.listAssessments(db, projectId, {});
  const groupName = new Map(impact.listGroups(db, projectId).map((g) => [g.id, g.name]));
  const subject = (kind: string, id: string | null) =>
    kind === 'group' ? (id ? (groupName.get(id) ?? 'Group') : 'Group') : kind === 'project' ? 'Overall' : kind;
  return toCsv(
    ['Type', 'Label', 'Subject', 'Scheduled', 'Completed', 'Status', 'Result'],
    list.map((a) => {
      let result = '';
      if (a.computed.pct) result = `S:${a.computed.pct.success ?? 'NA'} L:${a.computed.pct.leadership ?? 'NA'} PM:${a.computed.pct.project_management ?? 'NA'} CM:${a.computed.pct.change_management ?? 'NA'}`;
      else if (a.computed.risk) result = `CC:${a.computed.risk.cc ?? 'NA'} OA:${a.computed.risk.oa ?? 'NA'} ${a.computed.risk.quadrant ?? ''}`;
      else if (a.computed.adkar) result = `Barrier: ${a.computed.adkar.barrierPoint ?? ''}`;
      else if (a.computed.competency) result = `${a.computed.competency.total}/100 ${a.computed.competency.interpretation ?? ''}`;
      return [
        ASSESSMENT_TYPE_LABELS[a.type as AssessmentType] ?? a.type,
        a.label,
        subject(a.subjectKind, a.subjectId),
        a.scheduledDate,
        a.completedDate,
        a.status,
        result,
      ];
    }),
  );
}

const BUILDERS: Record<CsvDataset, (db: Db, projectId: string) => string> = {
  groups: groupsCsv,
  roles: rolesCsv,
  activities: activitiesCsv,
  assessments: assessmentsCsv,
};

export function exportCsv(db: Db, projectId: string, dataset: CsvDataset): string {
  projects.getProject(db, projectId);
  const builder = BUILDERS[dataset];
  if (!builder) throw new HttpError(404, `Unknown CSV dataset: ${dataset}`);
  return builder(db, projectId);
}

/** All datasets concatenated with section headers (dependency-free "Export all"). */
export function exportAllCsv(db: Db, projectId: string): string {
  const project = projects.getProject(db, projectId);
  const sections = CSV_DATASETS.map((dataset) => `# ${dataset.toUpperCase()}\r\n${BUILDERS[dataset](db, projectId)}`);
  return `# PROJECT: ${project.name}\r\n\r\n${sections.join('\r\n\r\n')}\r\n`;
}
