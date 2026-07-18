/**
 * Dropdown vocabularies, transcribed verbatim from the Proxima Offline
 * workbook's hidden "dropdowns" sheet.
 */

export const PROJECT_TYPES = [
  'Change Management Capability',
  'Construction Project',
  'Continuous Improvement',
  'Customer Experience (CX)',
  'Digital Transformation',
  'Employee Experience or Engagement',
  'Innovation Lab, Office or Events',
  'IT Software: Customer Relationship Management (CRM)',
  'IT Software: Electronic Health Records (EHR)',
  'IT Software: Enterprise Resource Planning (ERP)',
  'IT Software: Financial or Accounting System',
  'IT Software: Human Resources (HR) System or Tool',
  'IT Software: Other',
  'Manufacturing or Equipment Upgrade',
  'Merger, Acquisition or Divestiture',
  'Office Move, Redesign or Relocation',
  'Process Improvement, Redesign or Optimization',
  'Product or Service Development or Improvement',
  'Reduction in Workforce',
  'Regulatory Compliance Policy or Practices',
  'Reorganization or Business Model Change',
  'Research Process or Method',
  'Return to the Workplace or Virtual Work',
  'Safety Program or System',
  'Strategy or Culture Change',
  'Supply Chain Management',
  'Talent or Performance Management',
  'Technology System Upgrade or Retirement',
  'Other',
] as const;

export const PM_APPROACHES = ['Sequential', 'Iterative', 'Hybrid', 'Unsure'] as const;
export type PmApproach = (typeof PM_APPROACHES)[number];

export const PROJECT_STATUSES = ['Active', 'Completed', 'Paused / On Hold'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Standard role names offered in the roster dropdowns (free text still allowed). */
export const ROLE_NAME_OPTIONS = [
  'Primary Sponsor',
  'Sponsor Coalition Member',
  'People Managers',
  'Project Manager',
  'Change Practitioner',
  'Power Users',
  'Key Influencers',
  'Solution Developers',
  'Change Agent Network',
] as const;

export const ROLE_SUPPORT_LEVELS = ['Supportive', 'Neutral', 'Opposed'] as const;
export type RoleSupport = (typeof ROLE_SUPPORT_LEVELS)[number];

export const ROLE_INFLUENCE_LEVELS = ['High', 'Medium', 'Low'] as const;
export type RoleInfluence = (typeof ROLE_INFLUENCE_LEVELS)[number];

export const GAUGE_GAPS = ['Small', 'Medium', 'Large'] as const;
export type GaugeGap = (typeof GAUGE_GAPS)[number];

export const ACTIVITY_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const CM_PERF_STATUSES = [
  'No Progress',
  'Well Behind Target',
  'Behind Target',
  'On Target',
  'Ahead of Target',
] as const;
export type CmPerfStatus = (typeof CM_PERF_STATUSES)[number];

export const CM_PERF_TYPES = ['ADKAR Blueprint', 'Core Plan', 'Extend Plan'] as const;
export type CmPerfType = (typeof CM_PERF_TYPES)[number];

export const EXTEND_PLAN_OPTIONS = [
  'Sustainment Plan',
  'Resistance Management Plan',
  'Change Agent Network Plan',
  'Influencer Plan',
  'Sponsor Coalition Plan',
  'Super-User Plan',
] as const;

export const PLAN_TYPES = ['Activity Plan', 'Role Plan', 'Hybrid Plan'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/** The four core CM plans seeded for every project (Plan-C/T/S/P sheets). */
export const CORE_PLANS: ReadonlyArray<{ name: string; planType: PlanType }> = [
  { name: 'Communications Plan', planType: 'Activity Plan' },
  { name: 'Training Plan', planType: 'Activity Plan' },
  { name: 'Sponsor Plan', planType: 'Role Plan' },
  { name: 'People Manager Plan', planType: 'Role Plan' },
];

export const ROLE_ROSTERS = ['core', 'extend', 'sponsor_coalition'] as const;
export type RoleRoster = (typeof ROLE_ROSTERS)[number];

export const ROSTER_LABELS: Record<RoleRoster, string> = {
  core: 'Core Roles',
  extend: 'Extend Roles',
  sponsor_coalition: 'Sponsor Coalition',
};

/** Guidance from DA-Rl: which roles belong on each roster. */
export const ROSTER_HINTS: Record<RoleRoster, string> = {
  core: 'Core Roles to include: Primary Sponsor, People Managers, Project Manager, Change Practitioner',
  extend: 'Extend Roles to consider: Sponsor Coalition, Key Influencers, Solution Developers, Change Agent Network',
  sponsor_coalition: 'Senior leaders the primary sponsor engages to build a coalition of sponsorship.',
};

export const TRACKING_SCHEDULES = ['pct_check', 'adkar_check', 'cm_perf_check'] as const;
export type TrackingSchedule = (typeof TRACKING_SCHEDULES)[number];

export const TRACKING_SCHEDULE_LABELS: Record<TrackingSchedule, string> = {
  pct_check: 'Organizational Performance Tracking Schedule - PCT Status Checks',
  adkar_check: 'Individual Performance Tracking Schedule - ADKAR Status Checks',
  cm_perf_check: 'CM Performance Tracking Schedule - Blueprint and Plan Status Checks',
};
