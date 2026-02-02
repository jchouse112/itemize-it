-- Add notes field to receipts for bookkeeper context
ALTER TABLE public.ii_receipts ADD COLUMN IF NOT EXISTS notes text;
