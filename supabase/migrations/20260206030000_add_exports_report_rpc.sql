-- ============================================================================
-- PERFORMANCE: Server-side export report aggregation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ii_exports_report(
  p_business_id uuid,
  p_date_from date,
  p_date_to date,
  p_project_id uuid DEFAULT NULL,
  p_classifications text[] DEFAULT NULL,
  p_limit integer DEFAULT 10000
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH params AS (
    SELECT GREATEST(1, COALESCE(p_limit, 10000))::integer AS limit_n
  ),
  filtered_all AS (
    SELECT
      i.total_price_cents,
      i.classification::text AS classification,
      i.tax_category,
      i.project_id,
      i.receipt_id,
      r.merchant,
      r.purchase_date,
      r.status,
      COALESCE(p.name, 'Unknown') AS project_name
    FROM public.ii_receipt_items i
    JOIN public.ii_receipts r
      ON r.id = i.receipt_id
    LEFT JOIN public.ii_projects p
      ON p.id = i.project_id
    WHERE i.business_id = p_business_id
      AND i.is_split_original = false
      AND r.purchase_date >= p_date_from
      AND r.purchase_date <= p_date_to
      AND (p_project_id IS NULL OR i.project_id = p_project_id)
      AND (
        p_classifications IS NULL
        OR COALESCE(array_length(p_classifications, 1), 0) = 0
        OR i.classification::text = ANY(p_classifications)
      )
  ),
  limited_plus AS (
    SELECT *
    FROM filtered_all
    LIMIT (SELECT limit_n + 1 FROM params)
  ),
  limited_items AS (
    SELECT *
    FROM limited_plus
    LIMIT (SELECT limit_n FROM params)
  ),
  has_more AS (
    SELECT EXISTS (
      SELECT 1
      FROM limited_plus
      OFFSET (SELECT limit_n FROM params)
    ) AS truncated
  ),
  category_agg AS (
    SELECT
      COALESCE(tax_category, 'uncategorized') AS label,
      COALESCE(SUM(total_price_cents), 0)::bigint AS cents
    FROM limited_items
    GROUP BY 1
  ),
  project_agg AS (
    SELECT
      project_name AS label,
      COALESCE(SUM(total_price_cents), 0)::bigint AS cents
    FROM limited_items
    WHERE project_id IS NOT NULL
    GROUP BY 1
  ),
  month_agg AS (
    SELECT
      to_char(purchase_date, 'YYYY-MM') AS month,
      COALESCE(
        SUM(total_price_cents) FILTER (WHERE classification = 'business'),
        0
      )::bigint AS business_cents,
      COALESCE(
        SUM(total_price_cents) FILTER (WHERE classification = 'personal'),
        0
      )::bigint AS personal_cents,
      COALESCE(SUM(total_price_cents), 0)::bigint AS total_cents
    FROM limited_items
    WHERE purchase_date IS NOT NULL
    GROUP BY 1
  ),
  merchant_agg AS (
    SELECT
      COALESCE(merchant, 'Unknown') AS label,
      COALESCE(SUM(total_price_cents), 0)::bigint AS cents
    FROM limited_items
    GROUP BY 1
    ORDER BY cents DESC, label
    LIMIT 25
  ),
  summary AS (
    SELECT
      COALESCE(SUM(total_price_cents), 0)::bigint AS total_items_cents,
      COUNT(*)::bigint AS total_item_count,
      COUNT(DISTINCT receipt_id)::bigint AS receipt_count,
      COUNT(DISTINCT receipt_id) FILTER (WHERE status = 'exported')::bigint AS exported_receipt_count
    FROM limited_items
  )
  SELECT jsonb_build_object(
    'byCategoryData',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('label', label, 'cents', cents)
          ORDER BY cents DESC, label
        )
        FROM category_agg
      ),
      '[]'::jsonb
    ),
    'byProjectData',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('label', label, 'cents', cents)
          ORDER BY cents DESC, label
        )
        FROM project_agg
      ),
      '[]'::jsonb
    ),
    'monthlyData',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'month', month,
            'businessCents', business_cents,
            'personalCents', personal_cents,
            'totalCents', total_cents
          )
          ORDER BY month
        )
        FROM month_agg
      ),
      '[]'::jsonb
    ),
    'topMerchants',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('label', label, 'cents', cents)
          ORDER BY cents DESC, label
        )
        FROM merchant_agg
      ),
      '[]'::jsonb
    ),
    'totalItemsCents', COALESCE((SELECT total_items_cents FROM summary), 0),
    'totalItemCount', COALESCE((SELECT total_item_count FROM summary), 0),
    'receiptCount', COALESCE((SELECT receipt_count FROM summary), 0),
    'exportedReceiptCount', COALESCE((SELECT exported_receipt_count FROM summary), 0),
    'truncated', (SELECT truncated FROM has_more),
    'limit', (SELECT limit_n FROM params)
  );
$$;
