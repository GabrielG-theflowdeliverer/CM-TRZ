import { openDb, type Db } from './infra/db.js';
import { PCT_ITEM_KEYS, RISK_ITEM_KEYS } from '@cmt/domain';
import * as impact from './modules/impact/impact.service.js';
import * as roles from './modules/roles/roles.service.js';
import * as roadmap from './modules/roadmap/roadmap.service.js';
import * as assessments from './modules/assessments/assessments.service.js';
import * as blueprints from './modules/blueprints/blueprints.service.js';
import * as activities from './modules/activities/activities.service.js';
import * as cmPerf from './modules/cm-perf/cm-perf.service.js';
import * as orgGroups from './modules/org-groups/org-groups.service.js';
import * as outcomes from './modules/outcomes/outcomes.service.js';
import * as reinforcement from './modules/reinforcement/reinforcement.service.js';
import * as surveys from './modules/surveys/surveys.service.js';

/**
 * Enrich already-created but empty projects with a full, *varied* set of demo
 * data — so a portfolio of them lights up the dashboard, saturation heatmap,
 * outcomes and CM-performance views. Reuses the domain services (same as the
 * one-click demo generator) so every invariant holds and derived values compute
 * correctly.
 *
 *   CMT_DB_FILE=<db> tsx src/seed-demo.ts [projectId ...]
 *
 * With no ids, enriches every project that currently has zero impacted groups
 * (treats "no groups" as unseeded → idempotent: a second run skips them).
 */

interface GroupSpec {
  name: string;
  numPeople: number;
  tags: string[];
  aspects: { aspectKey: string; impact: number; yesterday?: string; tomorrow?: string }[];
  adkar: Record<string, number>;
  orgGroup: string; // shared pool → saturation overlap across projects
}

interface Variant {
  cmScore: number; // PCT change-management item score (drives the band/quadrant)
  otherScore: number; // PCT non-CM item score
  ccScore: number; // risk change-characteristics item score (section threshold: avg >= 3 -> High axis)
  oaScore: number; // risk organizational-attributes item score
  groups: GroupSpec[];
  sponsor: { roleName: string; personName: string };
  practitioner: string;
  kickoff: string;
  golive: string;
  outcomesDate: string;
  objective: string;
  adoptionName: string;
  adoption: [number, number]; // baseline-ish → latest measurement
  benefitName: string;
  benefitUnit: string;
  benefit: [number, number, number]; // baseline, target, latest
}

/** Curated variants for the known live projects; anything else cycles through them. */
const VARIANTS: Record<string, Variant> = {
  'Jira Migration': {
    cmScore: 3,
    otherScore: 3,
    ccScore: 4,
    oaScore: 2,
    groups: [
      {
        name: 'Engineering',
        numPeople: 45,
        tags: ['Frontline'],
        aspects: [
          { aspectKey: 'tools', impact: 5, yesterday: 'Legacy issue tracker', tomorrow: 'Jira workflows' },
          { aspectKey: 'processes', impact: 3 },
        ],
        adkar: { 'adkar.awareness': 4, 'adkar.desire': 3, 'adkar.knowledge': 3 },
        orgGroup: 'IT / Engineering',
      },
      {
        name: 'PMO',
        numPeople: 12,
        tags: ['Back office'],
        aspects: [{ aspectKey: 'reporting_structure', impact: 3 }],
        adkar: { 'adkar.awareness': 5, 'adkar.desire': 4, 'adkar.knowledge': 4, 'adkar.ability': 3 },
        orgGroup: 'Operations',
      },
    ],
    sponsor: { roleName: 'Engineering Director', personName: 'M. Okafor' },
    practitioner: 'R. Devi',
    kickoff: '2026-06-15',
    golive: '2026-09-01',
    outcomesDate: '2026-11-15',
    objective: 'Cut engineering cycle time with a unified issue tracker',
    adoptionName: 'Jira active usage',
    adoption: [20, 70],
    benefitName: 'Avg cycle time',
    benefitUnit: 'days',
    benefit: [12, 8, 9],
  },
  'Workflow Transformation': {
    cmScore: 2,
    otherScore: 3,
    ccScore: 5,
    oaScore: 4,
    groups: [
      {
        name: 'Operations',
        numPeople: 60,
        tags: ['Frontline'],
        aspects: [
          { aspectKey: 'processes', impact: 5, yesterday: 'Manual handoffs', tomorrow: 'Automated workflow' },
          { aspectKey: 'systems', impact: 4 },
          { aspectKey: 'job_roles', impact: 3 },
        ],
        adkar: { 'adkar.awareness': 3, 'adkar.desire': 2 },
        orgGroup: 'Operations',
      },
      {
        name: 'Customer Service',
        numPeople: 45,
        tags: ['Frontline'],
        aspects: [{ aspectKey: 'processes', impact: 4 }, { aspectKey: 'tools', impact: 4 }],
        adkar: { 'adkar.awareness': 3, 'adkar.desire': 3, 'adkar.knowledge': 2 },
        orgGroup: 'Customer Service',
      },
      {
        name: 'Finance',
        numPeople: 20,
        tags: ['Back office'],
        aspects: [{ aspectKey: 'processes', impact: 3 }],
        adkar: { 'adkar.awareness': 4, 'adkar.desire': 3 },
        orgGroup: 'Finance',
      },
    ],
    sponsor: { roleName: 'COO', personName: 'D. Hartley' },
    practitioner: 'S. Nakamura',
    kickoff: '2026-05-01',
    golive: '2026-10-01',
    outcomesDate: '2027-01-15',
    objective: 'Straight-through processing across operations',
    adoptionName: 'Workflow automation coverage',
    adoption: [10, 45],
    benefitName: 'Manual touches per case',
    benefitUnit: 'count',
    benefit: [8, 2, 5],
  },
  'Kantata Implementation': {
    cmScore: 4,
    otherScore: 4,
    ccScore: 2,
    oaScore: 2,
    groups: [
      {
        name: 'Delivery',
        numPeople: 35,
        tags: ['Frontline'],
        aspects: [
          { aspectKey: 'systems', impact: 4, yesterday: 'Spreadsheable planning', tomorrow: 'Kantata PSA' },
          { aspectKey: 'processes', impact: 3 },
        ],
        adkar: { 'adkar.awareness': 5, 'adkar.desire': 5, 'adkar.knowledge': 4, 'adkar.ability': 4, 'adkar.reinforcement': 4 },
        orgGroup: 'Operations',
      },
      {
        name: 'Resourcing',
        numPeople: 15,
        tags: ['Back office'],
        aspects: [{ aspectKey: 'tools', impact: 3 }],
        adkar: { 'adkar.awareness': 5, 'adkar.desire': 4, 'adkar.knowledge': 4, 'adkar.ability': 4 },
        orgGroup: 'Operations',
      },
    ],
    sponsor: { roleName: 'VP Delivery', personName: 'P. Alvarez' },
    practitioner: 'K. Owens',
    kickoff: '2026-07-01',
    golive: '2026-09-20',
    outcomesDate: '2026-12-10',
    objective: 'Improve resource utilization and project margin',
    adoptionName: 'Kantata timesheet compliance',
    adoption: [40, 90],
    benefitName: 'Billable utilization',
    benefitUnit: '%',
    benefit: [68, 80, 78],
  },
  'Zoho HR': {
    cmScore: 3,
    otherScore: 2,
    ccScore: 3,
    oaScore: 4,
    groups: [
      {
        name: 'All Employees',
        numPeople: 220,
        tags: ['Enterprise-wide'],
        aspects: [
          { aspectKey: 'systems', impact: 4, yesterday: 'Paper/HR email', tomorrow: 'Zoho self-service' },
          { aspectKey: 'processes', impact: 3 },
        ],
        adkar: { 'adkar.awareness': 3, 'adkar.desire': 3 },
        orgGroup: 'HR',
      },
      {
        name: 'HR Team',
        numPeople: 10,
        tags: ['Back office'],
        aspects: [{ aspectKey: 'processes', impact: 5 }, { aspectKey: 'job_roles', impact: 3 }],
        adkar: { 'adkar.awareness': 5, 'adkar.desire': 4, 'adkar.knowledge': 3 },
        orgGroup: 'HR',
      },
    ],
    sponsor: { roleName: 'CHRO', personName: 'L. Bianchi' },
    practitioner: 'T. Franklin',
    kickoff: '2026-06-01',
    golive: '2026-08-15',
    outcomesDate: '2026-11-01',
    objective: 'Self-service HR and faster onboarding',
    adoptionName: 'Self-service adoption',
    adoption: [15, 60],
    benefitName: 'Onboarding time',
    benefitUnit: 'days',
    benefit: [10, 4, 6],
  },
};

const FALLBACK = Object.values(VARIANTS);

function orgGroupByName(db: Db, name: string): string {
  return (orgGroups.listOrgGroups(db).find((g) => g.name === name) ?? orgGroups.createOrgGroup(db, { name })).id;
}

function enrichProject(db: Db, pid: string, name: string, v: Variant): void {
  const groupIds: string[] = [];
  for (const g of v.groups) {
    const group = impact.createGroup(db, pid, { name: g.name, numPeople: g.numPeople, tags: g.tags });
    impact.saveAspects(db, group.id, g.aspects);
    impact.saveGroupAdkar(db, group.id, g.adkar);
    impact.updateGroup(db, group.id, { orgGroupId: orgGroupByName(db, g.orgGroup) });
    groupIds.push(group.id);
  }

  const sponsor = roles.createRole(db, pid, {
    roster: 'core',
    roleName: v.sponsor.roleName,
    personName: v.sponsor.personName,
    support: 'Supportive',
    influence: 'High',
    groupIds,
  });
  roles.createRole(db, pid, { roster: 'core', roleName: 'Change Practitioner', personName: v.practitioner });

  roadmap.updateRoadmap(db, pid, {
    mode: 'sequential',
    kickoffDate: v.kickoff,
    goliveDate: v.golive,
    outcomesDate: v.outcomesDate,
    adkarMilestones: [
      { releaseNo: 0, element: 'awareness', date: v.kickoff },
      { releaseNo: 0, element: 'desire', date: v.kickoff },
      { releaseNo: 0, element: 'knowledge', date: v.golive },
      { releaseNo: 0, element: 'ability', date: v.golive },
      { releaseNo: 0, element: 'reinforcement', date: v.outcomesDate },
    ],
  });

  const pctRun = assessments.createAssessment(db, pid, {
    type: 'pct',
    subjectKind: 'project',
    label: 'Baseline',
    completedDate: v.kickoff,
    status: 'Completed',
  });
  const pct: Record<string, number> = {};
  for (const key of PCT_ITEM_KEYS) pct[key] = key.startsWith('pct.change_management') ? v.cmScore : v.otherScore;
  assessments.saveResponses(db, pctRun.id, pct);

  const riskRun = assessments.createAssessment(db, pid, {
    type: 'risk',
    subjectKind: 'project',
    label: 'Initial',
    completedDate: v.kickoff,
    status: 'Completed',
  });
  const risk: Record<string, number> = {};
  for (const key of RISK_ITEM_KEYS) risk[key] = key.startsWith('risk.cc') ? v.ccScore : v.oaScore;
  assessments.saveResponses(db, riskRun.id, risk);

  const overall = blueprints.listBlueprints(db, pid)[0];
  if (overall) {
    blueprints.addActivity(db, overall.id, { element: 'awareness', name: 'Kickoff briefing', startDate: v.kickoff, finishDate: v.kickoff });
    blueprints.addActivity(db, overall.id, { element: 'knowledge', name: 'Role-based training', startDate: v.golive, finishDate: v.golive });
  }

  const plans = db.prepare('SELECT id, name FROM plans WHERE project_id = ?').all(pid) as Array<{ id: string; name: string }>;
  const comms = plans.find((p) => p.name === 'Communications Plan');
  const training = plans.find((p) => p.name === 'Training Plan');
  activities.createActivity(db, pid, {
    name: 'Launch comms + FAQ',
    adkarOutcomes: ['awareness', 'knowledge'],
    groupIds,
    planIds: [comms?.id, training?.id].filter((x): x is string => !!x),
    roleIds: [sponsor.id],
    startDate: v.kickoff,
    finishDate: v.golive,
    status: 'Completed',
  });
  activities.createActivity(db, pid, {
    name: 'Hands-on training',
    adkarOutcomes: ['ability'],
    groupIds: groupIds.slice(0, 1),
    planIds: training ? [training.id] : [],
    startDate: v.golive,
    finishDate: v.outcomesDate,
    status: 'In Progress',
  });

  const report = cmPerf.createReport(db, pid, { name: 'Go-live readiness', date: v.golive });
  const firstItem = report.items[0];
  if (firstItem) cmPerf.updateItem(db, firstItem.id, { status: 'On Target', description: 'Awareness activities complete' });

  const objective = outcomes.createObjective(db, pid, { level: 'initiative', statement: v.objective });
  const adoptionMetric = outcomes.createMetric(db, objective.id, {
    kind: 'adoption', name: v.adoptionName, unit: '%', baseline: 0, target: 100, direction: 'increase',
    adoptionMeasure: 'utilization', groupId: groupIds[0],
  });
  outcomes.addMeasurement(db, adoptionMetric.id, { date: v.kickoff, value: v.adoption[0] });
  outcomes.addMeasurement(db, adoptionMetric.id, { date: v.golive, value: v.adoption[1] });
  const benefitMetric = outcomes.createMetric(db, objective.id, {
    kind: 'benefit', name: v.benefitName, unit: v.benefitUnit, baseline: v.benefit[0], target: v.benefit[1],
    direction: v.benefit[1] < v.benefit[0] ? 'decrease' : 'increase',
  });
  outcomes.addMeasurement(db, benefitMetric.id, { date: v.kickoff, value: v.benefit[0] });
  outcomes.addMeasurement(db, benefitMetric.id, { date: v.golive, value: v.benefit[2] });

  reinforcement.createAction(db, pid, { groupId: groupIds[0], mechanism: 'Manager recognition of wins in stand-up', owner: v.sponsor.personName, status: 'In Progress' });
  reinforcement.createAction(db, pid, { mechanism: 'Quarterly sustainment audit', status: 'Not Started' });

  const competency = assessments.createAssessment(db, pid, { type: 'sponsor_competency', subjectKind: 'person', label: 'Sponsor competency check' });
  surveys.createCampaign(db, pid, { assessmentId: competency.id, roleIds: [sponsor.id] });

  db.prepare('UPDATE projects SET watch_group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), pid);
  void name;
}

const dbFile = process.env.CMT_DB_FILE;
if (!dbFile) {
  console.error('usage: CMT_DB_FILE=<db> tsx src/seed-demo.ts [projectId ...]');
  process.exit(1);
}

const db = openDb(dbFile);
try {
  const argvIds = process.argv.slice(2);
  const targets = (
    argvIds.length
      ? (argvIds.map((id) => db.prepare('SELECT id, name FROM projects WHERE id = ?').get(id)).filter(Boolean) as Array<{ id: string; name: string }>)
      : (db
          .prepare(
            `SELECT p.id, p.name FROM projects p
             WHERE NOT EXISTS (SELECT 1 FROM impacted_groups g WHERE g.project_id = p.id)
             ORDER BY p.rowid`,
          )
          .all() as Array<{ id: string; name: string }>)
  );

  if (targets.length === 0) {
    console.log('No empty projects to seed (all have impacted groups already).');
  }
  let i = 0;
  for (const p of targets) {
    const variant = VARIANTS[p.name] ?? FALLBACK[i % FALLBACK.length]!;
    db.transaction(() => enrichProject(db, p.id, p.name, variant))();
    console.log(`seeded: ${p.name}`);
    i++;
  }
  console.log(`done — ${targets.length} project(s) seeded.`);
} finally {
  db.close();
}
