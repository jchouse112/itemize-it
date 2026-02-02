-- total_cents is populated by AI extraction AFTER the initial insert,
-- so it must be nullable to allow the initial "pending" receipt row.
ALTER TABLE public.ii_receipts ALTER COLUMN total_cents DROP NOT NULL;
