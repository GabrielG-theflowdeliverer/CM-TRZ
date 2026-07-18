import { PCT_ITEM_KEYS, RISK_ITEM_KEYS, type Project } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import * as projectsService from './projects.service.js';
import * as impact from '../impact/impact.service.js';
import * as roles from '../roles/roles.service.js';
import * as roadmap from '../roadmap/roadmap.service.js';
import * as assessments from '../assessments/assessments.service.js';
import * as blueprints from '../blueprints/blueprints.service.js';
import * as activities from '../activities/activities.service.js';
import * as cmPerf from '../cm-perf/cm-perf.service.js';

/** Seed a fully-populated sample project so the tool is explorable immediately. */
export function generateDemoProject(db: Db): Project {
  const project = projectsService.createProject(db, {
    name: 'Demo — CRM Transformation',
    projectType: 'IT Software: Customer Relationship Management (CRM)',
    pmApproach: 'Sequential',
  });
  const pid = project.id;

  // Impacted groups with aspects + ADKAR.
  const sales = impact.createGroup(db, pid, { name: 'Sales Team', numPeople: 40, tags: ['Frontline'] });
  impact.saveAspects(db, sales.id, [
    { aspectKey: 'processes', impact: 5, yesterday: 'Manual pipeline in spreadsheets', tomorrow: 'CRM-driven pipeline' },
    { aspectKey: 'systems', impact: 4, yesterday: 'Legacy CRM', tomorrow: 'New cloud CRM' },
    { aspectKey: 'tools', impact: 3 },
  ]);
  impact.saveGroupAdkar(db, sales.id, { 'adkar.awareness': 4, 'adkar.desire': 2, 'adkar.knowledge': 3 });

  const ops = impact.createGroup(db, pid, { name: 'Operations', numPeople: 25, tags: ['Back office'] });
  impact.saveAspects(db, ops.id, [
    { aspectKey: 'processes', impact: 3 },
    { aspectKey: 'reporting_structure', impact: 2 },
  ]);
  impact.saveGroupAdkar(db, ops.id, { 'adkar.awareness': 5, 'adkar.desire': 4, 'adkar.knowledge': 4, 'adkar.ability': 4, 'adkar.reinforcement': 4 });

  // Roles.
  const sponsor = roles.createRole(db, pid, {
    roster: 'core',
    roleName: 'Primary Sponsor',
    personName: 'J. Smith',
    support: 'Supportive',
    influence: 'High',
    groupIds: [sales.id, ops.id],
  });
  roles.createRole(db, pid, { roster: 'core', roleName: 'Change Practitioner', personName: 'A. Lee' });

  // Roadmap (also schedules the PCT assessments).
  roadmap.updateRoadmap(db, pid, {
    mode: 'sequential',
    kickoffDate: '2026-07-01',
    goliveDate: '2026-09-15',
    outcomesDate: '2026-12-01',
    adkarMilestones: [
      { releaseNo: 0, element: 'awareness', date: '2026-07-20' },
      { releaseNo: 0, element: 'desire', date: '2026-08-05' },
      { releaseNo: 0, element: 'knowledge', date: '2026-08-25' },
      { releaseNo: 0, element: 'ability', date: '2026-09-15' },
      { releaseNo: 0, element: 'reinforcement', date: '2026-10-15' },
    ],
  });

  // A completed PCT run and a high-risk assessment.
  const pctRun = assessments.createAssessment(db, pid, {
    type: 'pct',
    subjectKind: 'project',
    label: 'Baseline',
    completedDate: '2026-07-05',
    status: 'Completed',
  });
  const pct: Record<string, number> = {};
  for (const key of PCT_ITEM_KEYS) pct[key] = key.startsWith('pct.change_management') ? 2 : 3;
  assessments.saveResponses(db, pctRun.id, pct);

  const riskRun = assessments.createAssessment(db, pid, {
    type: 'risk',
    subjectKind: 'project',
    label: 'Initial',
    completedDate: '2026-07-06',
    status: 'Completed',
  });
  const risk: Record<string, number> = {};
  for (const key of RISK_ITEM_KEYS) risk[key] = 4;
  assessments.saveResponses(db, riskRun.id, risk);

  // Blueprint activities across ADKAR + a cross-plan activity.
  const overall = blueprints.listBlueprints(db, pid)[0]!;
  blueprints.addActivity(db, overall.id, { element: 'awareness', name: 'Kickoff town hall', startDate: '2026-07-01', finishDate: '2026-07-10' });
  blueprints.addActivity(db, overall.id, { element: 'desire', name: 'WIIFM roadshow', startDate: '2026-07-15', finishDate: '2026-08-01' });

  const plans = db.prepare('SELECT id, name FROM plans WHERE project_id = ?').all(pid) as Array<{ id: string; name: string }>;
  const commsPlan = plans.find((p) => p.name === 'Communications Plan');
  const trainingPlan = plans.find((p) => p.name === 'Training Plan');
  activities.createActivity(db, pid, {
    name: 'Launch email + FAQ',
    adkarOutcomes: ['awareness', 'knowledge'],
    groupIds: [sales.id, ops.id],
    planIds: [commsPlan?.id, trainingPlan?.id].filter((x): x is string => !!x),
    roleIds: [sponsor.id],
    startDate: '2026-07-02',
    finishDate: '2026-07-06',
    status: 'Completed',
  });
  activities.createActivity(db, pid, {
    name: 'Hands-on CRM training',
    adkarOutcomes: ['ability'],
    groupIds: [sales.id],
    planIds: trainingPlan ? [trainingPlan.id] : [],
    startDate: '2026-08-20',
    finishDate: '2026-09-10',
    status: 'In Progress',
  });

  // A CM performance report (auto-enumerates blueprints + plans).
  const report = cmPerf.createReport(db, pid, { name: 'Go-live readiness', date: '2026-08-15' });
  const firstItem = report.items[0];
  if (firstItem) cmPerf.updateItem(db, firstItem.id, { status: 'On Target', description: 'Awareness activities complete' });

  // Watch list.
  projectsService.updateProject(db, pid, { watchGroupIds: [sales.id, ops.id] });

  return projectsService.getProject(db, pid);
}
