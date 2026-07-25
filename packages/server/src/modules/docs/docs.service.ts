import { DOC_FIELDS, type DocKey, type ResistanceItem } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';
import * as repo from './docs.repo.js';

export function getDoc(db: Db, projectId: string, docKey: DocKey): Record<string, string | null> {
  getProject(db, projectId);
  const doc: Record<string, string | null> = {};
  // Every field the doc declares is present, null when unanswered.
  for (const field of DOC_FIELDS[docKey]) doc[field] = null;
  for (const { key, value } of repo.listDocFields(db, projectId, docKey)) doc[key] = value;
  return doc;
}

export function saveDoc(
  db: Db,
  projectId: string,
  docKey: DocKey,
  fields: Record<string, string | null>,
): Record<string, string | null> {
  getProject(db, projectId);
  repo.upsertDocFields(db, projectId, docKey, fields);
  return getDoc(db, projectId, docKey);
}

// ---------- resistance items ----------

function toItem(r: repo.ResistanceRow): ResistanceItem {
  return {
    id: r.id,
    projectId: r.project_id,
    position: r.position,
    groupId: r.group_id,
    groupLabel: r.group_label,
    anticipatedResistance: r.anticipated_resistance,
    specialTactics: r.special_tactics,
  };
}

/** Re-read after a write; the row is guaranteed to exist by the preceding insert/update. */
function readItem(db: Db, id: string): ResistanceItem {
  return toItem(repo.getResistanceRow(db, id)!);
}

export function listResistance(db: Db, projectId: string): ResistanceItem[] {
  getProject(db, projectId);
  return repo.listResistanceRows(db, projectId).map(toItem);
}

export function createResistance(
  db: Db,
  projectId: string,
  input: {
    groupId?: string | null;
    groupLabel?: string | null;
    anticipatedResistance?: string | null;
    specialTactics?: string | null;
  },
): ResistanceItem {
  getProject(db, projectId);
  if (input.groupId && repo.getGroupProjectId(db, input.groupId) !== projectId) {
    throw new HttpError(400, 'groupId does not belong to this project');
  }
  const id = newId();
  repo.insertResistance(db, {
    id,
    projectId,
    position: repo.nextResistancePosition(db, projectId),
    groupId: input.groupId ?? null,
    groupLabel: input.groupLabel ?? null,
    anticipatedResistance: input.anticipatedResistance ?? null,
    specialTactics: input.specialTactics ?? null,
  });
  return readItem(db, id);
}

export function updateResistance(
  db: Db,
  id: string,
  fields: Partial<Omit<ResistanceItem, 'id' | 'projectId'>>,
): ResistanceItem {
  if (!repo.updateResistance(db, id, fields)) notFound('Resistance item');
  return readItem(db, id);
}

export function deleteResistance(db: Db, id: string): void {
  if (!repo.deleteResistance(db, id)) notFound('Resistance item');
}
