-- ============================================================================
-- PERFORMANCE: Aggregate RPCs for project detail and dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ii_project_stats(p_project_id uuid)
RETURNS TABLE (
  item_count bigint,
  total_cents bigint,
  business_cents bigint,
  material_cents bigint,
  labour_cents bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS item_count,
    COALESCE(SUM(total_price_cents), 0)::bigint AS total_cents,
    COALESCE(SUM(total_price_cents) FILTER (WHERE classification = 'business'), 0)::bigint AS business_cents,
    COALESCE(
      SUM(total_price_cents) FILTER (
        WHERE classification = 'business' AND expense_type = 'material'
      ),
      0
    )::bigint AS material_cents,
    COALESCE(
      SUM(total_price_cents) FILTER (
        WHERE classification = 'business' AND expense_type = 'labour'
      ),
      0
    )::bigint AS labour_cents
  FROM public.ii_receipt_items
  WHERE project_id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION public.get_ii_dashboard_metrics(p_business_id uuid)
RETURNS TABLE (
  total_receipts bigint,
  pending_receipts bigint,
  total_spend_cents bigint,
  business_spend_cents bigint,
  business_items bigint,
  material_cents bigint,
  labour_cents bigint,
  overhead_cents bigint,
  personal_spend_cents bigint,
  personal_items bigint,
  unclassified_spend_cents bigint,
  unclassified_items bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH receipt_agg AS (
    SELECT
      COUNT(*)::bigint AS total_receipts,
      COUNT(*) FILTER (WHERE status IN ('pending', 'in_review'))::bigint AS pending_receipts,
      COALESCE(SUM(total_cents) FILTER (WHERE status = 'complete'), 0)::bigint AS total_spend_cents
    FROM public.ii_receipts
    WHERE business_id = p_business_id
  ),
  item_agg AS (
    SELECT
      COALESCE(SUM(total_price_cents) FILTER (WHERE classification = 'business'), 0)::bigint AS business_spend_cents,
      COUNT(*) FILTER (WHERE classification = 'business')::bigint AS business_items,
      COALESCE(
        SUM(total_price_cents) FILTER (
          WHERE classification = 'business' AND expense_type = 'material'
        ),
        0
      )::bigint AS material_cents,
      COALESCE(
        SUM(total_price_cents) FILTER (
          WHERE classification = 'business' AND expense_type = 'labour'
        ),
        0
      )::bigint AS labour_cents,
      COALESCE(
        SUM(total_price_cents) FILTER (
          WHERE classification = 'business' AND expense_type = 'overhead'
        ),
        0
      )::bigint AS overhead_cents,
      COALESCE(SUM(total_price_cents) FILTER (WHERE classification = 'personal'), 0)::bigint AS personal_spend_cents,
      COUNT(*) FILTER (WHERE classification = 'personal')::bigint AS personal_items,
      COALESCE(SUM(total_price_cents) FILTER (WHERE classification = 'unclassified'), 0)::bigint AS unclassified_spend_cents,
      COUNT(*) FILTER (WHERE classification = 'unclassified')::bigint AS unclassified_items
    FROM public.ii_receipt_items
    WHERE business_id = p_business_id
  )
  SELECT
    r.total_receipts,
    r.pending_receipts,
    r.total_spend_cents,
    i.business_spend_cents,
    i.business_items,
    i.material_cents,
    i.labour_cents,
    i.overhead_cents,
    i.personal_spend_cents,
    i.personal_items,
    i.unclassified_spend_cents,
    i.unclassified_items
  FROM receipt_agg r
  CROSS JOIN item_agg i;
$$;

CREATE OR REPLACE FUNCTION public.get_ii_dashboard_top_projects(
  p_business_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  name text,
  budget_cents integer,
  material_target_percent integer,
  spend_cents bigint,
  material_cents bigint,
  labour_cents bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH spend_by_project AS (
    SELECT
      project_id,
      COALESCE(SUM(total_price_cents), 0)::bigint AS spend_cents,
      COALESCE(
        SUM(total_price_cents) FILTER (
          WHERE classification = 'business' AND expense_type = 'material'
        ),
        0
      )::bigint AS material_cents,
      COALESCE(
        SUM(total_price_cents) FILTER (
          WHERE classification = 'business' AND expense_type = 'labour'
        ),
        0
      )::bigint AS labour_cents
    FROM public.ii_receipt_items
    WHERE business_id = p_business_id
      AND project_id IS NOT NULL
    GROUP BY project_id
  )
  SELECT
    p.id,
    p.name,
    p.budget_cents,
    p.material_target_percent,
    COALESCE(s.spend_cents, 0)::bigint AS spend_cents,
    COALESCE(s.material_cents, 0)::bigint AS material_cents,
    COALESCE(s.labour_cents, 0)::bigint AS labour_cents
  FROM public.ii_projects p
  LEFT JOIN spend_by_project s ON s.project_id = p.id
  WHERE p.business_id = p_business_id
    AND p.status = 'active'
  ORDER BY COALESCE(s.spend_cents, 0) DESC, p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));
$$;
