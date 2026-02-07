-- Add labour_type column to ii_receipt_items
-- Distinguishes employee labour (wages + EI/CPP/WSIB) from sub-contractor invoices (incl. HST).
-- NULL for non-labour items; only meaningful when expense_type = 'labour'.

ALTER TABLE public.ii_receipt_items
  ADD COLUMN IF NOT EXISTS labour_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ii_receipt_items_labour_type_check'
      AND conrelid = 'public.ii_receipt_items'::regclass
  ) THEN
    ALTER TABLE public.ii_receipt_items
      ADD CONSTRAINT ii_receipt_items_labour_type_check
      CHECK (labour_type IS NULL OR labour_type IN ('employee', 'subcontractor'));
  END IF;
END $$;

