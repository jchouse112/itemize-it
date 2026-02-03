-- ============================================================================
-- PERFORMANCE OPTIMIZATION: Covering Index for Project Stats Query
--
-- The projects list page aggregates item stats (count, total, classification)
-- for all projects. The existing partial index on (project_id, total_price_cents)
-- doesn't include classification, causing table lookups.
--
-- This migration drops the old index and creates a covering index that includes
-- all columns needed for the aggregation query.
-- ============================================================================

-- Drop the old partial covering index
DROP INDEX IF EXISTS public.idx_ii_receipt_items_project_totals;

-- Create a new covering index that includes classification
-- This allows the projects API to get all stats from the index alone (index-only scan)
CREATE INDEX IF NOT EXISTS idx_ii_receipt_items_project_stats
  ON public.ii_receipt_items(project_id, total_price_cents, classification)
  WHERE project_id IS NOT NULL;

COMMENT ON INDEX public.idx_ii_receipt_items_project_stats IS 'Covering index for project stats aggregation (count, total, classification)';

