/**
 * Helper texts, prompts and instructional content transcribed verbatim
 * from the Proxima Offline workbook.
 */

/** "DS" sheet — Phase 1, 4 P's to Define Success. */
export const DEFINE_SUCCESS_PROMPTS = {
  project: 'What is the project?',
  purpose: 'Why are we changing? What are the Project Objectives and Organizational Benefits?',
  particulars: 'What are we changing?',
  people: 'Who will be changing?',
  keyQuestion:
    'For your project, what percentage of overall results and outcomes depends on employee adoption and usage of the change?',
  keyQuestionTitle: 'The Key Question - Connecting People to Success',
} as const;

/** "WhyCM" sheet — The Value of CM. */
export const WHY_CM_PROMPTS = {
  title: 'Why Is Change Management Important For Your Project',
  humanFactorsTitle: 'The Human Factors that Determine ROI',
  speedOfAdoption:
    'Speed of Adoption - For your project, how will you define Speed of Adoption? How will it be measured? What is the target?',
  ultimateUtilization:
    'Ultimate Utilization - For your project, how will you define Ultimate Utilization? How will it be measured? What is the target?',
  proficiency:
    'Proficiency - For your project, how will you define Proficiency? How will it be measured? What is the target?',
  peopleDependentRoiTitle: 'People-Dependent ROI',
  peopleDependentRoi:
    'For your project, estimate the percent of overall results and outcomes that depends on employee adoption and usage:',
  investment: 'How much are we investing (budget, people, energy) in driving and supporting employee adoption and usage?',
  costsAndRisksTitle: 'Costs and Risks',
  costRiskRows: [
    'To the individuals impacted by the change',
    'To the project if we do not manage the people side of change well',
    'To the organization if we do not manage the people side of change well',
    'To the organization if this change does not deliver the results we expect',
  ],
} as const;

/** "DA-Res" sheet — Define Approach - Resources. */
export const RESOURCES_PROMPTS = {
  governanceTitle: 'Governance Model Structure',
  governanceDescription: 'Governance Description:',
  advantages: 'Advantages to Leverage:',
  implications: 'Implications to Mitigate:',
  sponsorAccess: 'Sponsor Access Evaluation:',
  actionItems: 'Action Items for Governance Model:',
  budgetTitle: 'Change Management Budget Evaluation',
  budgetPrepare: 'Prepare Approach Budget:',
  budgetManage: 'Manage Change Budget:',
  budgetSustain: 'Sustain Outcomes Budget:',
  budgetSource: 'Source of Budget:',
  budgetSufficiency: 'Sufficiency of Budget:',
} as const;

/** "Plan1" sheet — CM Plan activity grid column helper texts (row 18). */
export const PLAN_COLUMN_HELP = {
  activityName: 'What needs to be done?',
  adkarOutcome: 'What is the intended ADKAR outcome?  Which element is this activity targeting?',
  group: 'Which impacted group is the intended audience for the activity?',
  methodMechanism: 'What is the established process for completing the activity?',
  rolesRequired:
    'Who might you need to complete this activity?  Who is your preferred sender? What role is best positioned to take action?',
  responsible: 'Who should take the lead to ensure this activity is completed?',
  startDate: 'When should this activity start?',
  finishDate: 'When should this activity complete?',
  status: 'Is this activity not started, in progress or complete?',
  resultFeedback: 'What is the result or outcome of the activity?  How do you know?',
} as const;

/** "Plan1" column headers (WHAT/WHY/WHO/HOW/WHEN). */
export const PLAN_COLUMN_HEADERS = {
  activityName: 'Activity Name (WHAT)',
  adkarOutcome: 'ADKAR Outcome (WHY)',
  group: 'Group (WHO)',
  methodMechanism: 'Method / Mechanism (HOW)',
  rolesRequired: 'Role(s) Required (WHO)',
  responsible: 'Responsible (WHO)',
  startDate: 'Start date',
  finishDate: 'Finish date',
  status: 'Status',
  resultFeedback: 'Result / Feedback',
} as const;

/** "DA-Rl" sheet — role roster column notes. */
export const ROLE_COLUMN_HELP = {
  roleDefinition: 'Employee-centered Role Definition (I __ by __)',
  support: 'Support (supportive, neutral, opposed)',
  influence: 'Influence (high, medium, low)',
  activationTactics: 'Activation tactics to help them effectively fulfill their change management role.',
} as const;

/** "AdAct" sheet — Adapt Actions structure. */
export const ADAPT_ACTIONS_PROMPTS = {
  what: 'What:',
  soWhat: 'So What:',
  nowWhat: 'Now What:',
  observations: 'Observations:',
  implications: 'Implications:',
  actionSteps: 'Action Steps:',
  assessmentResults: 'Assessment results:',
  strengths: 'Strengths:',
  opportunities: 'Opportunities:',
} as const;

/** "Info" sheet — description of Proxima (About page). */
export const ABOUT_TEXT =
  'Proxima is a cloud-based web application accessed through the Prosci Portal that guides you through the Prosci Methodology focusing on the people side of change. ' +
  'Add projects or change initiatives, assess and track project health, and direct progress through the Prosci 3-Phase Process (phases, stages, activities) with the ADKAR Model at its core.  ' +
  'Proxima follows a structured, adaptable, and repeatable approach to help change leaders and practitioners achieve change success throughout a project or initiative.';

/** License reminder shown on the About page (summarized from the Terms sheet). */
export const LICENSE_NOTE =
  'The Prosci content reproduced in this tool is licensed under a Prosci Digital Product Single User License. ' +
  'It is for the license holder’s personal use on their own projects and must not be reproduced, distributed or shared with others.';
