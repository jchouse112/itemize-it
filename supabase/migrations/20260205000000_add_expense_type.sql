-- Add expense_type column to ii_receipt_items
-- Classifies business expenses as material, labour, or overhead.
-- Defaults to 'material' for backward compatibility (existing items are implicitly materials).

ALTER TABLE public.ii_receipt_items
  ADD COLUMN IF NOT EXISTS expense_type text DEFAULT 'material';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ii_receipt_items_expense_type_check'
      AND conrelid = 'public.ii_receipt_items'::regclass
  ) THEN
    ALTER TABLE public.ii_receipt_items
      ADD CONSTRAINT ii_receipt_items_expense_type_check
      CHECK (expense_type IN ('material', 'labour', 'overhead'));
  END IF;
END $$;

-- Composite index for dashboard/project queries that filter by business + expense_type
CREATE INDEX IF NOT EXISTS idx_ii_receipt_items_expense_type
  ON public.ii_receipt_items (business_id, expense_type);
