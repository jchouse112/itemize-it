-- Itemize-It Database Schema
-- Phase 2: Core Tables with RLS

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  budget_limit DECIMAL(12, 2),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Index for user lookups
CREATE INDEX idx_projects_user_id ON public.projects(user_id);

-- ============================================
-- RECEIPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_name TEXT,
  total_amount DECIMAL(12, 2),
  scan_status TEXT NOT NULL DEFAULT 'uploading' CHECK (scan_status IN ('uploading', 'processing', 'complete', 'failed')),
  image_url TEXT,
  receipt_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receipts
CREATE POLICY "Users can view their own receipts"
  ON public.receipts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receipts"
  ON public.receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receipts"
  ON public.receipts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receipts"
  ON public.receipts FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX idx_receipts_scan_status ON public.receipts(scan_status);

-- ============================================
-- RECEIPT_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'personal' CHECK (category IN ('material', 'asset', 'personal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receipt_items (through receipt ownership)
CREATE POLICY "Users can view their own receipt items"
  ON public.receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id
      AND receipts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own receipt items"
  ON public.receipt_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id
      AND receipts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own receipt items"
  ON public.receipt_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id
      AND receipts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own receipt items"
  ON public.receipt_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id
      AND receipts.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_receipt_items_receipt_id ON public.receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_project_id ON public.receipt_items(project_id);

-- ============================================
-- ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  purchase_date DATE,
  value DECIMAL(12, 2),
  receipt_item_id UUID REFERENCES public.receipt_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assets
CREATE POLICY "Users can view their own assets"
  ON public.assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets"
  ON public.assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets"
  ON public.assets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets"
  ON public.assets FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_assets_user_id ON public.assets(user_id);

-- ============================================
-- PRICE HISTORY TABLE (for inflation warnings)
-- ============================================
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_description TEXT NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own price history"
  ON public.price_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price history"
  ON public.price_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for price lookups
CREATE INDEX idx_price_history_item ON public.price_history(user_id, item_description);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receipt_items_updated_at
  BEFORE UPDATE ON public.receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STORAGE BUCKET FOR RECEIPT IMAGES
-- ============================================
-- Run this in Supabase Dashboard > Storage or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

-- Storage RLS policies (run in Dashboard):
-- CREATE POLICY "Users can upload their own receipts"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view their own receipts"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
