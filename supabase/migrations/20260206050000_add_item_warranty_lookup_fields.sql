-- Item-level warranty tracking fields to support manual Perplexity checks
-- and "needs warranty check" lifecycle filtering.

ALTER TABLE public.ii_receipt_items
  ADD COLUMN IF NOT EXISTS warranty_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_eligibility_reason text,
  ADD COLUMN IF NOT EXISTS track_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_lookup_status text NOT NULL DEFAULT 'unknown'
    CHECK (warranty_lookup_status IN ('unknown', 'in_progress', 'found', 'not_found', 'error', 'not_eligible')),
  ADD COLUMN IF NOT EXISTS warranty_end_date date,
  ADD COLUMN IF NOT EXISTS warranty_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS warranty_lookup_confidence numeric(3, 2)
    CHECK (warranty_lookup_confidence >= 0 AND warranty_lookup_confidence <= 1),
  ADD COLUMN IF NOT EXISTS warranty_lookup_source text
    CHECK (warranty_lookup_source IN ('receipt', 'manufactured_year', 'ai_lookup', 'manual_entry')),
  ADD COLUMN IF NOT EXISTS warranty_lookup_error text,
  ADD COLUMN IF NOT EXISTS warranty_lookup_metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_ii_receipt_items_warranty_queue
  ON public.ii_receipt_items (business_id, warranty_lookup_status, warranty_checked_at DESC)
  WHERE warranty_eligible = true OR track_warranty = true;

CREATE INDEX IF NOT EXISTS idx_ii_receipt_items_warranty_end_date
  ON public.ii_receipt_items (business_id, warranty_end_date ASC)
  WHERE warranty_end_date IS NOT NULL;
