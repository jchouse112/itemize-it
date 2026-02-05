-- Add expense_type column to ii_receipt_items
-- Classifies business expenses as material, labour, or overhead.
-- Defaults to 'material' for backward compatibility (existing items are implicitly materials).

ALTER TABLE public.ii_receipt_items
  ADD COLUMN expense_type text DEFAULT 'material'
  CHECK (expense_type IN ('material', 'labour', 'overhead'));

-- Composite index for dashboard/project queries that filter by business + expense_type
CREATE INDEX idx_ii_receipt_items_expense_type
  ON public.ii_receipt_items (business_id, expense_type);

