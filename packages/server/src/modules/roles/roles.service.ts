import { adkarScoresFromResponses, barrierPoint, type Role } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import * as repo from './roles.repo.js';
import * as assessments from '../assessments/assessments.service.js';
import { getProject } from '../projects/projects.service.js';

export interface RoleWithComputed extends Role {
  computed: { barrierPoint: string | null };
}

function assembleRole(db: Db, row: repo.RoleRow): RoleWithComputed {
  const latestAdkar = assessments.latestAssessment(db, row.project_id, 'adkar', { kind: 'role', id: row.id });
  const scores = latestAdkar ? adkarScoresFromResponses(latestAdkar.responses) : {};
  return {
    id: row.id,
    projectId: row.project_id,
    roster: row.roster,
    position: row.position,
    roleName: row.role_name,
    personName: row.person_name,
    roleDefinition: row.role_definition,
    support: row.support,
    influence: row.influence,
    activationTactics: row.activation_tactics,
    groupIds: repo.getRoleGroupIds(db, row.id),
    adkar: Object.fromEntries(Object.entries(scores)),
    adkarAssessmentId: latestAdkar?.id ?? null,
    computed: { barrierPoint: barrierPoint(scores) },
  };
}

export function listRoles(db: Db, projectId: string): RoleWithComputed[] {
  getProject(db, projectId);
  return repo.listRoleRows(db, projectId).map((row) => assembleRole(db, row));
}

export function getRole(db: Db, id: string): RoleWithComputed {
  const row = repo.getRoleRow(db, id) ?? notFound('Role');
  return assembleRole(db, row);
}

export function createRole(
  db: Db,
  projectId: string,
  input: {
    roster: string;
    roleName?: string | null;
    personName?: string | null;
    roleDefinition?: string | null;
    support?: string | null;
    influence?: string | null;
    activationTactics?: string | null;
    groupIds?: string[];
  },
): RoleWithComputed {
  getProject(db, projectId);
  const id = newId();
  repo.insertRole(db, {
    id,
    projectId,
    roster: input.roster,
    position: repo.nextRolePosition(db, projectId, input.roster),
    roleName: input.roleName ?? null,
    personName: input.personName ?? null,
    roleDefinition: input.roleDefinition ?? null,
    support: input.support ?? null,
    influence: input.influence ?? null,
    activationTactics: input.activationTactics ?? null,
  });
  if (input.groupIds?.length) repo.setRoleGroups(db, id, input.groupIds);
  return getRole(db, id);
}

export function updateRole(
  db: Db,
  id: string,
  fields: Parameters<typeof repo.updateRole>[2] & { groupIds?: string[] },
): RoleWithComputed {
  if (!repo.updateRole(db, id, fields)) notFound('Role');
  if (fields.groupIds !== undefined) repo.setRoleGroups(db, id, fields.groupIds);
  return getRole(db, id);
}

export function deleteRole(db: Db, id: string): void {
  const row = repo.getRoleRow(db, id) ?? notFound('Role');
  db.transaction(() => {
    db.prepare(`DELETE FROM assessments WHERE subject_kind = 'role' AND subject_id = ?`).run(row.id);
    repo.deleteRole(db, id);
  })();
}

export function saveRoleAdkar(db: Db, roleId: string, responses: Record<string, number | null>): RoleWithComputed {
  const row = repo.getRoleRow(db, roleId) ?? notFound('Role');
  assessments.upsertSubjectAdkar(db, row.project_id, 'role', row.id, responses);
  return getRole(db, roleId);
}
