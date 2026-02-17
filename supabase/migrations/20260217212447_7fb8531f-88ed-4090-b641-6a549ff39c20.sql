-- Remove unused columns from playground_projects
-- These columns were never populated by the application
ALTER TABLE playground_projects DROP COLUMN IF EXISTS sandbox_id;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS sandbox_status;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS preview_url;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS template_id;
ALTER TABLE playground_projects DROP COLUMN IF EXISTS design_options;