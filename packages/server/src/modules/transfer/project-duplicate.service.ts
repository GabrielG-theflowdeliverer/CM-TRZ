import type { Project } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';
import { exportProject } from './project-export.service.js';
import { importProject } from './project-import.service.js';

/** Duplicate = lossless export -> import under a new name. */
export function duplicateProject(db: Db, projectId: string): Project {
  const source = getProject(db, projectId) ?? notFound('Project');
  const payload = exportProject(db, projectId);
  return importProject(db, payload, { name: `${source.name} (copy)` });
}
