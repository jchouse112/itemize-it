-- ============================================================================
-- PERFORMANCE OPTIMIZATION: Additional Indexes for Common Query Patterns
--
-- This migration adds missing indexes identified from page loading analysis.
-- Generated: 2026-02-03
-- ============================================================================

-- ============================================
-- 1. NOTIFICATIONS TABLE (was missing entirely)
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'receipt_processed', 'items_need_review', 'export_ready',
    'warranty_expiring', 'return_closing', 'recall_alert',
    'duplicate_detected', 'project_budget_warning'
  )),
  entity_id uuid,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Primary query pattern: list notifications for user, ordered by created_at DESC
CREATE INDEX IF NOT EXISTS idx_ii_notifications_user_business
  ON public.ii_notifications(business_id, user_id, created_at DESC);

-- Filter unread notifications (common for badge counts)
CREATE INDEX IF NOT EXISTS idx_ii_notifications_unread
  ON public.ii_notifications(business_id, user_id)
  WHERE read = false;

ALTER TABLE public.ii_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ii_notifications'
      AND policyname = 'ii_notifications_select'
  ) THEN
    CREATE POLICY "ii_notifications_select" ON public.ii_notifications
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ii_notifications'
      AND policyname = 'ii_notifications_update'
  ) THEN
    CREATE POLICY "ii_notifications_update" ON public.ii_notifications
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ii_notifications'
      AND policyname = 'ii_notifications_insert'
  ) THEN
    CREATE POLICY "ii_notifications_insert" ON public.ii_notifications
      FOR INSERT WITH CHECK (public.has_business_access(business_id));
  END IF;
END $$;

-- ============================================
-- 2. RECEIPTS: Optimize listing by created_at DESC
-- ============================================

-- The main receipts list page orders by created_at DESC, but existing index
-- only covers (business_id, created_at) without DESC ordering.
-- This covering index optimizes the primary query pattern.
CREATE INDEX IF NOT EXISTS idx_ii_receipts_business_created_desc
  ON public.ii_receipts(business_id, created_at DESC);

-- ============================================
-- 3. RETURNS: Optimize status filtering
-- ============================================

-- The returns API filters by business_id + status and orders by return_by
CREATE INDEX IF NOT EXISTS idx_ii_returns_business_status
  ON public.ii_returns(business_id, status, return_by ASC);

-- ============================================
-- 4. RECALL MATCHES: Optimize status filtering
-- ============================================

-- The recalls API filters by status (active/dismissed/resolved)
-- Composite index for business + status filtering ordered by matched_at
CREATE INDEX IF NOT EXISTS idx_ii_recall_matches_business_status_date
  ON public.ii_recall_matches(business_id, status, matched_at DESC);

-- Partial index for active (non-dismissed) recalls only
CREATE INDEX IF NOT EXISTS idx_ii_recall_matches_active
  ON public.ii_recall_matches(business_id, matched_at DESC)
  WHERE status = 'active';

-- ============================================
-- 5. RECEIPT ITEMS: Optimize project aggregation queries
-- ============================================

-- Dashboard aggregates items by project_id - add covering index
CREATE INDEX IF NOT EXISTS idx_ii_receipt_items_project_totals
  ON public.ii_receipt_items(project_id, total_price_cents)
  WHERE project_id IS NOT NULL;

-- ============================================
-- 6. WARRANTIES: Optimize expiring soon queries
-- ============================================

-- The warranties API filters for active (end_date >= now) warranties
-- and expiring soon (end_date between now and now+30 days)
CREATE INDEX IF NOT EXISTS idx_ii_warranties_business_end_date
  ON public.ii_warranties(business_id, end_date ASC);

-- ============================================
-- 7. AUDIT EVENTS: Optimize recent events lookup
-- ============================================

-- Common pattern: get recent audit events for a business
CREATE INDEX IF NOT EXISTS idx_ii_audit_events_business_created_desc
  ON public.ii_audit_events(business_id, created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.ii_notifications IS 'In-app notifications for users (receipts processed, recalls, etc.)';
COMMENT ON INDEX public.idx_ii_receipts_business_created_desc IS 'Optimizes receipt listing with created_at DESC ordering';
COMMENT ON INDEX public.idx_ii_notifications_user_business IS 'Primary index for notification fetching';
COMMENT ON INDEX public.idx_ii_recall_matches_active IS 'Partial index for non-dismissed recalls only';
