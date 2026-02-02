-- Add file_hash column for duplicate detection via SHA-256
ALTER TABLE public.ii_receipts
  ADD COLUMN IF NOT EXISTS file_hash text;

CREATE INDEX IF NOT EXISTS idx_ii_receipts_file_hash
  ON public.ii_receipts(business_id, file_hash)
  WHERE file_hash IS NOT NULL;
