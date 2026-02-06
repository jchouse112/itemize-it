-- ============================================================================
-- PERFORMANCE: Projects list with aggregated stats in one DB query
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ii_projects_with_stats(
  p_business_id uuid,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  business_id uuid,
  user_id uuid,
  name text,
  description text,
  client_name text,
  budget_cents integer,
  material_target_percent integer,
  lat numeric,
  lng numeric,
  radius_meters integer,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  item_count bigint,
  total_cents bigint,
  business_cents bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH item_stats AS (
    SELECT
      project_id,
      COUNT(*)::bigint AS item_count,
      COALESCE(SUM(total_price_cents), 0)::bigint AS total_cents,
      COALESCE(
        SUM(total_price_cents) FILTER (WHERE classification = 'business'),
        0
      )::bigint AS business_cents
    FROM public.ii_receipt_items
    WHERE project_id IS NOT NULL
    GROUP BY project_id
  )
  SELECT
    p.id,
    p.business_id,
    p.user_id,
    p.name,
    p.description,
    p.client_name,
    p.budget_cents,
    p.material_target_percent,
    p.lat,
    p.lng,
    p.radius_meters,
    p.status,
    p.created_at,
    p.updated_at,
    COALESCE(s.item_count, 0)::bigint AS item_count,
    COALESCE(s.total_cents, 0)::bigint AS total_cents,
    COALESCE(s.business_cents, 0)::bigint AS business_cents
  FROM public.ii_projects p
  LEFT JOIN item_stats s ON s.project_id = p.id
  WHERE p.business_id = p_business_id
    AND (p_status IS NULL OR p.status = p_status)
  ORDER BY p.created_at DESC;
$$;
