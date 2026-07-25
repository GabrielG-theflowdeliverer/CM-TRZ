import type { OrgGroup } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import * as repo from './org-groups.repo.js';

export function listOrgGroups(db: Db): OrgGroup[] {
  return repo.listOrgGroups(db);
}

/** Whether an org group exists — the registry's answer for modules that link to it. */
export function orgGroupExists(db: Db, id: string): boolean {
  return repo.orgGroupExists(db, id);
}

export function createOrgGroup(db: Db, input: { name: string }): OrgGroup {
  const group = { id: newId(), name: input.name, createdAt: nowIso() };
  repo.insertOrgGroup(db, group);
  return { id: group.id, name: group.name, createdAt: group.createdAt };
}
