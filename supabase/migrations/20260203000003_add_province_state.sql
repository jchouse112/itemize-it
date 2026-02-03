-- Add province/state field to businesses table for province-specific tax messaging
-- This allows showing the correct tax type (e.g., HST for Ontario, GST/QST for Quebec)

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS province_state text;

-- Add a comment explaining the field
COMMENT ON COLUMN public.businesses.province_state IS 'Two-letter province/state code (e.g., ON, QC, CA, NY) for tax jurisdiction display';

