import { ADKAR_ELEMENTS, type Blueprint, type BlueprintSnapshot } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './blueprints.repo.js';
import { sequentialAdkarMilestones } from '../roadmap/roadmap.service.js';
import { getProject } from '../projects/projects.service.js';

export interface BlueprintWithComputed extends Blueprint {
  groupName: string | null;
  /** Effective milestone per element: override if set, else the roadmap default. */
  computed: { milestones: Record<string, { effectiveDate: string | null; fromRoadmap: boolean }> };
}

function assemble(db: Db, row: repo.BlueprintRow): BlueprintWithComputed {
  const elements = repo.getElements(db, row.id);
  const byElement = new Map(elements.map((e) => [e.element, e]));
  const fullElements = ADKAR_ELEMENTS.map(
    (element) => byElement.get(element) ?? { element, milestoneOverrideDate: null, gaugeGap: null },
  );
  const roadmapDefaults = sequentialAdkarMilestones(db, row.project_id);
  const milestones: Record<string, { effectiveDate: string | null; fromRoadmap: boolean }> = {};
  for (const el of fullElements) {
    const override = el.milestoneOverrideDate;
    milestones[el.element] = override
      ? { effectiveDate: override, fromRoadmap: false }
      : { effectiveDate: roadmapDefaults[el.element] ?? null, fromRoadmap: true };
  }
  const groupName = row.group_id
    ? ((db.prepare('SELECT name FROM impacted_groups WHERE id = ?').get(row.group_id) as { name: string } | undefined)
        ?.name ?? null)
    : null;
  return {
    id: row.id,
    projectId: row.project_id,
    scopeKind: row.scope_kind,
    groupId: row.group_id,
    name: row.name,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    elements: fullElements,
    activities: repo.getActivities(db, row.id),
    groupName,
    computed: { milestones },
  };
}

export function listBlueprints(db: Db, projectId: string): BlueprintWithComputed[] {
  getProject(db, projectId);
  return repo.listBlueprintRows(db, projectId).map((row) => assemble(db, row));
}

export function getBlueprint(db: Db, id: string): BlueprintWithComputed {
  const row = repo.getBlueprintRow(db, id) ?? notFound('Blueprint');
  return assemble(db, row);
}

export function createBlueprint(
  db: Db,
  projectId: string,
  input: { scopeKind: string; groupId?: string | null; name: string; notes?: string | null },
): BlueprintWithComputed {
  getProject(db, projectId);
  if (input.scopeKind === 'group') {
    if (!input.groupId) throw new HttpError(400, 'groupId is required for a group-scoped blueprint');
    const group = db
      .prepare('SELECT project_id FROM impacted_groups WHERE id = ?')
      .get(input.groupId) as { project_id: string } | undefined;
    if (!group || group.project_id !== projectId) throw new HttpError(400, 'groupId does not belong to this project');
  }
  const id = newId();
  repo.insertBlueprint(db, {
    id,
    projectId,
    scopeKind: input.scopeKind,
    groupId: input.scopeKind === 'group' ? (input.groupId ?? null) : null,
    name: input.name,
    notes: input.notes ?? null,
    createdAt: nowIso(),
  });
  return getBlueprint(db, id);
}

export function updateBlueprint(
  db: Db,
  id: string,
  fields: { name?: string; notes?: string | null },
): BlueprintWithComputed {
  if (!repo.updateBlueprint(db, id, fields, nowIso())) notFound('Blueprint');
  return getBlueprint(db, id);
}

export function deleteBlueprint(db: Db, id: string): void {
  if (!repo.deleteBlueprint(db, id)) notFound('Blueprint');
}

export function saveElement(
  db: Db,
  blueprintId: string,
  element: string,
  fields: { milestoneOverrideDate?: string | null; gaugeGap?: string | null },
): BlueprintWithComputed {
  const row = repo.getBlueprintRow(db, blueprintId) ?? notFound('Blueprint');
  repo.upsertElement(db, row.id, element, fields);
  repo.updateBlueprint(db, row.id, {}, nowIso());
  return getBlueprint(db, blueprintId);
}

export function addActivity(
  db: Db,
  blueprintId: string,
  input: {
    element: string;
    name?: string | null;
    rolesRequired?: string | null;
    startDate?: string | null;
    finishDate?: string | null;
    status?: string | null;
  },
): BlueprintWithComputed {
  const row = repo.getBlueprintRow(db, blueprintId) ?? notFound('Blueprint');
  repo.insertActivity(db, {
    id: newId(),
    blueprintId: row.id,
    element: input.element,
    position: repo.nextActivityPosition(db, row.id, input.element),
    name: input.name ?? null,
    rolesRequired: input.rolesRequired ?? null,
    startDate: input.startDate ?? null,
    finishDate: input.finishDate ?? null,
    status: input.status ?? 'Not Started',
  });
  repo.updateBlueprint(db, row.id, {}, nowIso());
  return getBlueprint(db, blueprintId);
}

export function updateActivity(
  db: Db,
  activityId: string,
  fields: Parameters<typeof repo.updateActivity>[2],
): BlueprintWithComputed {
  const result = repo.updateActivity(db, activityId, fields) ?? notFound('Blueprint activity');
  repo.updateBlueprint(db, result.blueprintId, {}, nowIso());
  return getBlueprint(db, result.blueprintId);
}

export function deleteActivity(db: Db, activityId: string): BlueprintWithComputed {
  const result = repo.deleteActivity(db, activityId) ?? notFound('Blueprint activity');
  return getBlueprint(db, result.blueprintId);
}

export function listSnapshots(db: Db, blueprintId: string): BlueprintSnapshot[] {
  const row = repo.getBlueprintRow(db, blueprintId) ?? notFound('Blueprint');
  const rows = db
    .prepare('SELECT * FROM blueprint_snapshots WHERE blueprint_id = ? ORDER BY taken_at DESC')
    .all(row.id) as Array<{ id: string; blueprint_id: string; label: string; taken_at: string; payload: string }>;
  return rows.map((r) => ({
    id: r.id,
    blueprintId: r.blueprint_id,
    label: r.label,
    takenAt: r.taken_at,
    payload: JSON.parse(r.payload),
  }));
}

/** Freeze the blueprint's full current state under a label. */
export function takeSnapshot(db: Db, blueprintId: string, label: string): BlueprintSnapshot {
  const blueprint = getBlueprint(db, blueprintId);
  const id = newId();
  const takenAt = nowIso();
  const payload = JSON.stringify({
    name: blueprint.name,
    notes: blueprint.notes,
    elements: blueprint.elements,
    activities: blueprint.activities,
    milestones: blueprint.computed.milestones,
  });
  db.prepare(
    'INSERT INTO blueprint_snapshots (id, blueprint_id, label, taken_at, payload) VALUES (?, ?, ?, ?, ?)',
  ).run(id, blueprintId, label, takenAt, payload);
  return { id, blueprintId, label, takenAt, payload: JSON.parse(payload) };
}

export function deleteSnapshot(db: Db, snapshotId: string): void {
  const changes = db.prepare('DELETE FROM blueprint_snapshots WHERE id = ?').run(snapshotId).changes;
  if (changes === 0) notFound('Snapshot');
}
