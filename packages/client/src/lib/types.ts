/** Server response shapes (entities + server-computed blocks). */
import type {
  Activity,
  AdaptAction,
  Assessment,
  Blueprint,
  BlueprintSnapshot,
  CmPerfReport,
  ImpactedGroup,
  Plan,
  PctScores,
  ProgressSummary,
  Project,
  ResistanceItem,
  RiskQuadrant,
  Roadmap,
  Role,
  TrackingEntry,
} from '@cmt/domain';

export type {
  Activity,
  AdaptAction,
  Assessment,
  Blueprint,
  BlueprintSnapshot,
  CmPerfReport,
  ImpactedGroup,
  Plan,
  Project,
  ResistanceItem,
  Roadmap,
  Role,
  TrackingEntry,
};

export interface AssessmentComputed {
  pct?: PctScores;
  risk?: { cc: number | null; oa: number | null; quadrant: RiskQuadrant | null };
  adkar?: { scores: Record<string, number | null>; barrierPoint: string | null };
  competency?: { total: number; interpretation: string | null };
}

/**
 * Survey roll-up attached to an assessment once a campaign has collected
 * submissions: the aggregated responses already drive `computed`; this block
 * adds the respondent count and each respondent's own per-item answers (plus
 * their computed score) for the side-by-side results matrix. Absent until
 * someone submits.
 */
export interface AssessmentSurveyView {
  respondentCount: number;
  individuals: Array<{
    personName: string;
    responses: Record<string, number | null>;
    computed: AssessmentComputed;
  }>;
}

export type AssessmentDto = Assessment & {
  computed: AssessmentComputed;
  survey?: AssessmentSurveyView;
};

export type GroupDto = ImpactedGroup & {
  computed: {
    aspectsImpacted: number;
    degreeOfImpact: number | null;
    barrierPoint: string | null;
    risk: { assessmentId: string; cc: number | null; oa: number | null; quadrant: RiskQuadrant | null } | null;
  };
};

export type RoleDto = Role & { computed: { barrierPoint: string | null } };

export type BlueprintDto = Blueprint & {
  groupName: string | null;
  computed: { milestones: Record<string, { effectiveDate: string | null; fromRoadmap: boolean }> };
};

export type PlanDto = Plan & { computed: { progress: ProgressSummary } };

export interface ProjectHealthDto {
  projectId: string;
  name: string;
  projectType: string | null;
  pmApproach: string | null;
  pct: { scores: PctScores; date: string | null } | null;
  risk: { cc: number | null; oa: number | null; quadrant: RiskQuadrant | null; date: string | null } | null;
  groupCount: number;
  totalPeople: number;
  avgDegreeOfImpact: number | null;
  barrierDistribution: Record<string, number>;
  progress: ProgressSummary;
  overdueCount: number;
  latestCmPerfStatus: string | null;
  nextMilestone: { date: string; label: string } | null;
  outcomes: {
    realization: number | null;
    adoption: number | null;
    benefit: number | null;
    metricCount: number;
    measuredCount: number;
  };
  checksDueSoon: number;
}

export interface DashboardDto {
  summary: {
    totalProjects: number;
    highRiskCount: number;
    overdueActivities: number;
    checksDueSoon: number;
    avgRealization: number | null;
  };
  projects: ProjectHealthDto[];
  correlationPoints: Array<{
    projectId: string;
    projectName: string;
    group: string;
    adkar: number | null;
    adoption: number | null;
    barrier: string | null;
  }>;
  generatedAt: string;
}
