-- Token expiry (hardening for public hosting): bound how long an opaque,
-- internet-reachable token stays valid. Nullable = no expiry, so tokens issued
-- before this migration keep working; new ones are stamped with a default TTL
-- at creation/rotation and are rejected once past.
--
-- Survey expiry lives on the recipient (not the campaign) so a single lapsed
-- link can be regenerated on its own without disturbing the others.
ALTER TABLE survey_recipients ADD COLUMN expires_at TEXT;
ALTER TABLE projects ADD COLUMN share_token_expires_at TEXT;
