-- Add material target percentage to projects
-- Allows contractors to set a target for material costs as a percentage of budget

ALTER TABLE public.ii_projects
ADD COLUMN IF NOT EXISTS material_target_percent integer
  CHECK (material_target_percent IS NULL OR (material_target_percent >= 0 AND material_target_percent <= 100));

COMMENT ON COLUMN public.ii_projects.material_target_percent IS 
  'Target percentage of budget that should be spent on materials (0-100)';

