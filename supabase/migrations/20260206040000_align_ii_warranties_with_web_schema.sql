-- Align ii_warranties with fields used by web lifecycle code.
-- Safe for existing environments via IF NOT EXISTS and nullable additions.

ALTER TABLE public.ii_warranties
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_item_id uuid REFERENCES public.ii_receipt_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_estimated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_source text CHECK (
    warranty_source IN ('receipt', 'manufactured_year', 'ai_lookup', 'manual_entry')
  ),
  ADD COLUMN IF NOT EXISTS product_name text;

-- Backfill new receipt_item_id from legacy item_id when present.
UPDATE public.ii_warranties
SET receipt_item_id = item_id
WHERE receipt_item_id IS NULL
  AND item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ii_warranties_user_id ON public.ii_warranties(user_id);
CREATE INDEX IF NOT EXISTS idx_ii_warranties_receipt_item_id ON public.ii_warranties(receipt_item_id);
