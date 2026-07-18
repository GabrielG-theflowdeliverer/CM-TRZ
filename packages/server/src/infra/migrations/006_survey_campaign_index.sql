-- Roll-up reads (assessments.service.present → surveys.getAssessmentSurvey)
-- look up campaigns by assessment_id on every assessment read; index it so the
-- common path is a covered lookup rather than a scan of survey_campaigns.
CREATE INDEX idx_survey_campaigns_assessment ON survey_campaigns(assessment_id);
