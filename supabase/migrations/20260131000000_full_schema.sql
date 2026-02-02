-- ============================================================================
-- ITEMIZE-IT: FULL SCHEMA FOR STANDALONE SUPABASE PROJECT
--
-- Run this in the new Supabase project's SQL Editor to set up all tables.
-- This is a clean-room schema — no ii_ prefix needed since this is
-- a dedicated project. However, we keep the ii_ prefix for consistency
-- with the existing app code that references these table names.
--
-- Generated: 2026-01-31
-- ============================================================================

-- ============================================
-- 1. BUSINESSES & TEAM MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Business info
  name text NOT NULL DEFAULT 'My Business',
  business_type text CHECK (business_type IN (
    'sole_proprietor', 'llc', 'corporation', 's_corp',
    'partnership', 'nonprofit', 'other'
  )),
  tax_id text,

  -- Settings
  default_currency text DEFAULT 'USD',
  timezone text DEFAULT 'America/New_York',
  projects_enabled boolean DEFAULT true,

  -- Tax jurisdiction
  tax_jurisdiction text DEFAULT 'US' CHECK (tax_jurisdiction IN ('US', 'CA')),

  -- Plan & limits
  plan_tier text DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise')),
  limits_json jsonb DEFAULT '{
    "uploads_per_month": 50,
    "exports_per_month": 5,
    "seats": 1,
    "retention_days": 90,
    "projects_limit": 5
  }'::jsonb,

  -- Billing
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Email forwarding
  ii_forwarding_email text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_ii_forwarding_email_unique UNIQUE (ii_forwarding_email);

CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'removed')),

  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(business_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.business_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),

  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(business_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON public.businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_ii_forwarding_email ON public.businesses(ii_forwarding_email) WHERE ii_forwarding_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_members_business_id ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user_id ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_active ON public.business_members(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_business_invitations_token ON public.business_invitations(token);
CREATE INDEX IF NOT EXISTS idx_business_invitations_email ON public.business_invitations(email);

-- ============================================
-- 2. HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.has_business_access(p_business_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_business_admin(p_business_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_business_owner(p_business_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.businesses
    WHERE id = p_business_id
      AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT business_id
    FROM public.business_members
    WHERE user_id = auth.uid()
      AND status = 'active'
    ORDER BY
      CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 3. RLS: BUSINESSES
-- ============================================

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own businesses"
  ON public.businesses FOR SELECT
  USING (public.has_business_access(id));

CREATE POLICY "Users can create businesses"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update business"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete business"
  ON public.businesses FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS: Business Members
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view business members"
  ON public.business_members FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Admin can add members"
  ON public.business_members FOR INSERT
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Admin can update members"
  ON public.business_members FOR UPDATE
  USING (public.is_business_admin(business_id) AND user_id != auth.uid())
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Admin can remove members or self-remove"
  ON public.business_members FOR DELETE
  USING (
    (public.is_business_admin(business_id) AND user_id != auth.uid())
    OR (user_id = auth.uid() AND role != 'owner')
  );

-- RLS: Business Invitations
ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view invitations"
  ON public.business_invitations FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Admin can create invitations"
  ON public.business_invitations FOR INSERT
  WITH CHECK (public.is_business_admin(business_id));

CREATE POLICY "Admin can cancel invitations"
  ON public.business_invitations FOR DELETE
  USING (public.is_business_admin(business_id));

-- ============================================
-- 4. BUSINESS TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_businesses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_businesses_updated
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_businesses_updated_at();

CREATE OR REPLACE FUNCTION public.handle_business_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.business_members (business_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_business_created
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_business_owner_membership();

-- ============================================
-- 5. RECEIPTS & ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source tracking
  storage_key text,

  -- Merchant info
  merchant text,
  merchant_address text,
  merchant_phone text,

  -- Transaction details
  purchase_date date,
  purchase_time time,
  total_cents integer NOT NULL,
  subtotal_cents integer,
  tax_cents integer,
  tip_cents integer,
  currency text DEFAULT 'USD',

  -- Payment tracking
  payment_method text CHECK (payment_method IN (
    'cash', 'credit_card', 'debit_card', 'check', 'ach', 'wire', 'other'
  )),
  payment_source text DEFAULT 'unknown' CHECK (payment_source IN (
    'business_funds', 'personal_funds', 'mixed', 'unknown'
  )),
  card_last_four text,

  -- Classification summary
  has_business_items boolean DEFAULT false,
  has_personal_items boolean DEFAULT false,
  has_unclassified_items boolean DEFAULT true,
  needs_review boolean DEFAULT true,

  -- AI extraction metadata
  confidence_score numeric(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  extraction_model text,
  is_manually_edited boolean DEFAULT false,

  -- Workflow state
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_review', 'complete', 'exported', 'archived'
  )),

  -- Project association
  project_id uuid,

  -- Email metadata
  email_message_id text,
  email_from text,
  email_subject text,
  email_received_at timestamptz,

  -- Lifecycle flags
  has_warranty boolean NOT NULL DEFAULT false,
  has_return_window boolean NOT NULL DEFAULT false,
  has_recall_match boolean NOT NULL DEFAULT false,
  is_potential_duplicate boolean NOT NULL DEFAULT false,
  duplicate_of_receipt_id uuid REFERENCES public.ii_receipts(id) ON DELETE SET NULL,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  exported_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.ii_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.ii_receipts(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item details
  name text NOT NULL,
  description text,
  quantity numeric(10, 3) DEFAULT 1,
  unit_price_cents integer,
  total_price_cents integer NOT NULL,

  -- Tax breakdown
  subtotal_cents integer,
  tax_cents integer,
  tax_rate numeric(5, 4),
  tax_calculation_method text CHECK (tax_calculation_method IN (
    'extracted', 'prorated', 'manual', 'exempt'
  )),

  -- Classification
  classification text DEFAULT 'unclassified' CHECK (classification IN (
    'business', 'personal', 'unclassified'
  )),
  classification_confidence numeric(3, 2) CHECK (classification_confidence >= 0 AND classification_confidence <= 1),
  classified_at timestamptz,
  classified_by uuid REFERENCES auth.users(id),

  -- Category
  category text,
  category_confidence numeric(3, 2) CHECK (category_confidence >= 0 AND category_confidence <= 1),
  category_locked boolean DEFAULT false,

  -- IRS + CRA tax categories
  tax_category text CHECK (tax_category IN (
    -- IRS Schedule C (US)
    'advertising', 'car_truck_expenses', 'commissions_fees', 'contract_labor',
    'depletion', 'depreciation', 'employee_benefits', 'insurance',
    'interest_mortgage', 'interest_other', 'legal_professional', 'office_expense',
    'pension_profit_sharing', 'rent_lease_vehicles', 'rent_lease_equipment',
    'rent_lease_property', 'repairs_maintenance', 'supplies', 'taxes_licenses',
    'travel', 'meals', 'utilities', 'wages', 'other_expenses',
    'cost_of_goods_sold', 'not_deductible',
    -- CRA T2125 (Canada)
    'cra_advertising', 'cra_meals_entertainment', 'cra_bad_debts', 'cra_insurance',
    'cra_interest_bank_charges', 'cra_business_tax_fees_licences', 'cra_office_expenses',
    'cra_supplies', 'cra_legal_accounting', 'cra_management_admin', 'cra_rent',
    'cra_repairs_maintenance', 'cra_salaries_wages_benefits', 'cra_property_taxes',
    'cra_travel', 'cra_utilities', 'cra_fuel', 'cra_delivery_freight',
    'cra_motor_vehicle', 'cra_capital_cost_allowance', 'cra_other_expenses',
    'cra_cost_of_goods_sold', 'cra_home_office', 'cra_telephone_internet',
    'cra_not_deductible'
  )),

  -- Project association
  project_id uuid,

  -- Split item support
  parent_item_id uuid REFERENCES public.ii_receipt_items(id) ON DELETE CASCADE,
  is_split_original boolean DEFAULT false,
  split_ratio numeric(5, 4),

  -- Review queue
  review_reasons text[] DEFAULT '{}',
  needs_review boolean GENERATED ALWAYS AS (array_length(review_reasons, 1) > 0) STORED,

  -- Notes
  notes text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes: ii_receipts
CREATE INDEX idx_ii_receipts_business_id ON public.ii_receipts(business_id);
CREATE INDEX idx_ii_receipts_user_id ON public.ii_receipts(user_id);
CREATE INDEX idx_ii_receipts_purchase_date ON public.ii_receipts(business_id, purchase_date DESC);
CREATE INDEX idx_ii_receipts_status ON public.ii_receipts(business_id, status);
CREATE INDEX idx_ii_receipts_needs_review ON public.ii_receipts(business_id) WHERE needs_review = true;
CREATE INDEX idx_ii_receipts_project ON public.ii_receipts(project_id) WHERE project_id IS NOT NULL;

-- Indexes: ii_receipt_items
CREATE INDEX idx_ii_receipt_items_receipt_id ON public.ii_receipt_items(receipt_id);
CREATE INDEX idx_ii_receipt_items_business_id ON public.ii_receipt_items(business_id);
CREATE INDEX idx_ii_receipt_items_classification ON public.ii_receipt_items(business_id, classification);
CREATE INDEX idx_ii_receipt_items_category ON public.ii_receipt_items(business_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_ii_receipt_items_tax_category ON public.ii_receipt_items(business_id, tax_category) WHERE tax_category IS NOT NULL;
CREATE INDEX idx_ii_receipt_items_needs_review ON public.ii_receipt_items(business_id) WHERE needs_review = true;
CREATE INDEX idx_ii_receipt_items_parent ON public.ii_receipt_items(parent_item_id) WHERE parent_item_id IS NOT NULL;
CREATE INDEX idx_ii_receipt_items_project ON public.ii_receipt_items(project_id) WHERE project_id IS NOT NULL;

-- RLS: ii_receipts
ALTER TABLE public.ii_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business receipts"
  ON public.ii_receipts FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Users can insert business receipts"
  ON public.ii_receipts FOR INSERT
  WITH CHECK (
    public.has_business_access(business_id)
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update business receipts"
  ON public.ii_receipts FOR UPDATE
  USING (public.has_business_access(business_id))
  WITH CHECK (public.has_business_access(business_id));

CREATE POLICY "Admins can delete business receipts"
  ON public.ii_receipts FOR DELETE
  USING (public.is_business_admin(business_id));

-- RLS: ii_receipt_items
ALTER TABLE public.ii_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business items"
  ON public.ii_receipt_items FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Users can insert business items"
  ON public.ii_receipt_items FOR INSERT
  WITH CHECK (
    public.has_business_access(business_id)
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update business items"
  ON public.ii_receipt_items FOR UPDATE
  USING (public.has_business_access(business_id))
  WITH CHECK (public.has_business_access(business_id));

CREATE POLICY "Admins can delete business items"
  ON public.ii_receipt_items FOR DELETE
  USING (public.is_business_admin(business_id));

-- Triggers: updated_at
CREATE OR REPLACE FUNCTION public.handle_ii_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ii_receipts_updated
  BEFORE UPDATE ON public.ii_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ii_receipts_updated_at();

CREATE OR REPLACE FUNCTION public.handle_ii_receipt_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ii_receipt_items_updated
  BEFORE UPDATE ON public.ii_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ii_receipt_items_updated_at();

-- Trigger: Sync receipt flags from items
CREATE OR REPLACE FUNCTION public.sync_ii_receipt_classification_flags()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ii_receipts
  SET
    has_business_items = EXISTS (
      SELECT 1 FROM public.ii_receipt_items
      WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
        AND classification = 'business'
        AND parent_item_id IS NULL
    ),
    has_personal_items = EXISTS (
      SELECT 1 FROM public.ii_receipt_items
      WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
        AND classification = 'personal'
        AND parent_item_id IS NULL
    ),
    has_unclassified_items = EXISTS (
      SELECT 1 FROM public.ii_receipt_items
      WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
        AND classification = 'unclassified'
        AND parent_item_id IS NULL
    ),
    needs_review = EXISTS (
      SELECT 1 FROM public.ii_receipt_items
      WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
        AND needs_review = true
    )
  WHERE id = COALESCE(NEW.receipt_id, OLD.receipt_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_receipt_flags_on_item_change
  AFTER INSERT OR UPDATE OF classification, review_reasons, parent_item_id OR DELETE
  ON public.ii_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ii_receipt_classification_flags();

-- ============================================
-- 6. PROJECTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name text NOT NULL,
  description text,
  client_name text,

  budget_cents integer,

  -- GPS geo-fencing
  lat numeric(10,7),
  lng numeric(10,7),
  radius_meters integer DEFAULT 100,

  color text DEFAULT '#F97316',

  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Indexes
CREATE INDEX idx_ii_projects_business_id ON public.ii_projects(business_id);
CREATE INDEX idx_ii_projects_user_id ON public.ii_projects(user_id);
CREATE INDEX idx_ii_projects_status ON public.ii_projects(business_id, status) WHERE status = 'active';
CREATE INDEX idx_ii_projects_location ON public.ii_projects(lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Add project_id FK to ii_receipts and ii_receipt_items
ALTER TABLE public.ii_receipts
ADD CONSTRAINT fk_ii_receipts_project
FOREIGN KEY (project_id) REFERENCES public.ii_projects(id) ON DELETE SET NULL;

ALTER TABLE public.ii_receipt_items
ADD CONSTRAINT fk_ii_receipt_items_project
FOREIGN KEY (project_id) REFERENCES public.ii_projects(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.ii_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business projects"
  ON public.ii_projects FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Members can create projects"
  ON public.ii_projects FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_business_access(business_id)
  );

CREATE POLICY "Members can update projects"
  ON public.ii_projects FOR UPDATE
  USING (public.has_business_access(business_id))
  WITH CHECK (public.has_business_access(business_id));

CREATE POLICY "Admin can delete projects"
  ON public.ii_projects FOR DELETE
  USING (public.is_business_admin(business_id));

-- Triggers
CREATE OR REPLACE FUNCTION public.handle_ii_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ii_projects_updated
  BEFORE UPDATE ON public.ii_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ii_projects_updated_at();

-- Helper Functions
CREATE OR REPLACE FUNCTION public.get_ii_project_expenses_total(p_project_id uuid)
RETURNS integer AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN subtotal_cents IS NOT NULL THEN subtotal_cents + COALESCE(tax_cents, 0)
      ELSE total_price_cents
    END
  ), 0)
  INTO total
  FROM public.ii_receipt_items
  WHERE project_id = p_project_id
    AND classification = 'business'
    AND is_split_original = false;

  RETURN total;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.find_nearest_ii_project(
  p_business_id uuid,
  p_lat numeric,
  p_lng numeric
)
RETURNS uuid AS $$
DECLARE
  nearest_id uuid;
BEGIN
  SELECT id INTO nearest_id
  FROM public.ii_projects
  WHERE business_id = p_business_id
    AND status = 'active'
    AND lat IS NOT NULL
    AND lng IS NOT NULL
    AND (
      6371000 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(p_lat - lat) / 2), 2) +
        COS(RADIANS(lat)) * COS(RADIANS(p_lat)) *
        POWER(SIN(RADIANS(p_lng - lng) / 2), 2)
      ))
    ) <= radius_meters
  ORDER BY
    POWER(p_lat - lat, 2) + POWER(p_lng - lng, 2)
  LIMIT 1;

  RETURN nearest_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 7. CLASSIFICATION RULES
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_classification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  rule_type text NOT NULL CHECK (rule_type IN ('merchant', 'keyword', 'category')),
  pattern text NOT NULL,
  match_mode text DEFAULT 'contains' CHECK (match_mode IN ('exact', 'contains', 'starts_with')),

  classification text NOT NULL CHECK (classification IN ('business', 'personal')),
  tax_category text,
  project_id uuid REFERENCES public.ii_projects(id) ON DELETE SET NULL,
  payment_source text CHECK (payment_source IN ('business_funds', 'personal_funds')),

  priority integer DEFAULT 0,

  times_applied integer DEFAULT 0,
  last_applied_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(business_id, rule_type, pattern)
);

CREATE INDEX idx_ii_classification_rules_business ON public.ii_classification_rules(business_id);
CREATE INDEX idx_ii_classification_rules_user ON public.ii_classification_rules(user_id);
CREATE INDEX idx_ii_classification_rules_priority ON public.ii_classification_rules(business_id, priority DESC);

ALTER TABLE public.ii_classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business rules"
  ON public.ii_classification_rules FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Members can create rules"
  ON public.ii_classification_rules FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_business_access(business_id)
  );

CREATE POLICY "Members can update own rules"
  ON public.ii_classification_rules FOR UPDATE
  USING (auth.uid() = user_id AND public.has_business_access(business_id))
  WITH CHECK (auth.uid() = user_id AND public.has_business_access(business_id));

CREATE POLICY "Members can delete own rules"
  ON public.ii_classification_rules FOR DELETE
  USING (auth.uid() = user_id AND public.has_business_access(business_id));

CREATE OR REPLACE FUNCTION public.handle_ii_classification_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ii_classification_rules_updated
  BEFORE UPDATE ON public.ii_classification_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ii_classification_rules_updated_at();

CREATE OR REPLACE FUNCTION public.find_ii_matching_classification_rule(
  p_business_id uuid,
  p_merchant text,
  p_item_name text,
  p_category text
)
RETURNS TABLE (
  rule_id uuid,
  classification text,
  tax_category text,
  project_id uuid,
  payment_source text,
  confidence numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS rule_id,
    cr.classification,
    cr.tax_category,
    cr.project_id,
    cr.payment_source,
    CASE
      WHEN cr.match_mode = 'exact' THEN 0.95
      WHEN cr.match_mode = 'starts_with' THEN 0.85
      ELSE 0.75
    END::numeric AS confidence
  FROM public.ii_classification_rules cr
  WHERE cr.business_id = p_business_id
    AND (
      (cr.rule_type = 'merchant' AND (
        (cr.match_mode = 'exact' AND LOWER(p_merchant) = LOWER(cr.pattern)) OR
        (cr.match_mode = 'contains' AND LOWER(p_merchant) LIKE '%' || LOWER(cr.pattern) || '%') OR
        (cr.match_mode = 'starts_with' AND LOWER(p_merchant) LIKE LOWER(cr.pattern) || '%')
      ))
      OR
      (cr.rule_type = 'keyword' AND (
        (cr.match_mode = 'exact' AND LOWER(p_item_name) = LOWER(cr.pattern)) OR
        (cr.match_mode = 'contains' AND LOWER(p_item_name) LIKE '%' || LOWER(cr.pattern) || '%') OR
        (cr.match_mode = 'starts_with' AND LOWER(p_item_name) LIKE LOWER(cr.pattern) || '%')
      ))
      OR
      (cr.rule_type = 'category' AND LOWER(p_category) = LOWER(cr.pattern))
    )
  ORDER BY cr.priority DESC, cr.times_applied DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.increment_ii_rule_usage(p_rule_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.ii_classification_rules
  SET
    times_applied = times_applied + 1,
    last_applied_at = now()
  WHERE id = p_rule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. AUDIT EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  entity_type text NOT NULL CHECK (entity_type IN (
    'receipt', 'item', 'project', 'rule', 'export', 'business', 'member'
  )),
  entity_id uuid NOT NULL,

  event_type text NOT NULL CHECK (event_type IN (
    'receipt_created', 'receipt_updated', 'receipt_deleted', 'receipt_reparsed',
    'item_classified', 'item_category_changed', 'item_project_assigned',
    'item_split', 'item_merged', 'item_tax_updated', 'item_amount_changed',
    'duplicate_flagged', 'duplicate_ignored', 'duplicate_merged',
    'project_created', 'project_updated', 'project_archived', 'project_completed', 'project_deleted',
    'rule_created', 'rule_updated', 'rule_deleted',
    'export_created', 'export_downloaded',
    'business_updated', 'member_invited', 'member_joined', 'member_removed', 'member_role_changed'
  )),

  before_state jsonb,
  after_state jsonb,
  metadata jsonb DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ii_audit_events_entity ON public.ii_audit_events(entity_type, entity_id);
CREATE INDEX idx_ii_audit_events_business_time ON public.ii_audit_events(business_id, created_at DESC);
CREATE INDEX idx_ii_audit_events_actor ON public.ii_audit_events(actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_ii_audit_events_type ON public.ii_audit_events(event_type);

ALTER TABLE public.ii_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business audit events"
  ON public.ii_audit_events FOR SELECT
  USING (public.has_business_access(business_id));

CREATE OR REPLACE FUNCTION public.log_ii_audit_event(
  p_business_id uuid,
  p_actor_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_before_state jsonb DEFAULT NULL,
  p_after_state jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  event_id uuid;
BEGIN
  INSERT INTO public.ii_audit_events (
    business_id, actor_id, entity_type, entity_id, event_type,
    before_state, after_state, metadata
  )
  VALUES (
    p_business_id, p_actor_id, p_entity_type, p_entity_id, p_event_type,
    p_before_state, p_after_state, p_metadata
  )
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_ii_entity_audit_history(
  p_entity_type text,
  p_entity_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  event_type text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.actor_id,
    ae.event_type,
    ae.before_state,
    ae.after_state,
    ae.created_at
  FROM public.ii_audit_events ae
  WHERE ae.entity_type = p_entity_type
    AND ae.entity_id = p_entity_id
    AND public.has_business_access(ae.business_id)
  ORDER BY ae.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Automatic audit trigger for item changes
CREATE OR REPLACE FUNCTION public.audit_ii_receipt_item_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.classification IS DISTINCT FROM NEW.classification THEN
      PERFORM public.log_ii_audit_event(
        NEW.business_id, auth.uid(), 'item', NEW.id, 'item_classified',
        jsonb_build_object('classification', OLD.classification),
        jsonb_build_object('classification', NEW.classification)
      );
    END IF;

    IF OLD.tax_category IS DISTINCT FROM NEW.tax_category THEN
      PERFORM public.log_ii_audit_event(
        NEW.business_id, auth.uid(), 'item', NEW.id, 'item_category_changed',
        jsonb_build_object('tax_category', OLD.tax_category),
        jsonb_build_object('tax_category', NEW.tax_category)
      );
    END IF;

    IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
      PERFORM public.log_ii_audit_event(
        NEW.business_id, auth.uid(), 'item', NEW.id, 'item_project_assigned',
        jsonb_build_object('project_id', OLD.project_id),
        jsonb_build_object('project_id', NEW.project_id)
      );
    END IF;

    IF OLD.total_price_cents IS DISTINCT FROM NEW.total_price_cents
       OR OLD.subtotal_cents IS DISTINCT FROM NEW.subtotal_cents THEN
      PERFORM public.log_ii_audit_event(
        NEW.business_id, auth.uid(), 'item', NEW.id, 'item_amount_changed',
        jsonb_build_object('total_price_cents', OLD.total_price_cents, 'subtotal_cents', OLD.subtotal_cents),
        jsonb_build_object('total_price_cents', NEW.total_price_cents, 'subtotal_cents', NEW.subtotal_cents)
      );
    END IF;

    IF OLD.tax_cents IS DISTINCT FROM NEW.tax_cents THEN
      PERFORM public.log_ii_audit_event(
        NEW.business_id, auth.uid(), 'item', NEW.id, 'item_tax_updated',
        jsonb_build_object('tax_cents', OLD.tax_cents),
        jsonb_build_object('tax_cents', NEW.tax_cents)
      );
    END IF;

    IF OLD.is_split_original IS DISTINCT FROM NEW.is_split_original
       AND NEW.is_split_original = true THEN
      PERFORM public.log_ii_audit_event(
        NEW.business_id, auth.uid(), 'item', NEW.id, 'item_split',
        jsonb_build_object('is_split_original', OLD.is_split_original),
        jsonb_build_object('is_split_original', NEW.is_split_original)
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_ii_receipt_items
  AFTER UPDATE ON public.ii_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_ii_receipt_item_changes();

-- ============================================
-- 9. SPLIT ITEM INVARIANT
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_ii_split_item_invariant()
RETURNS TRIGGER AS $$
DECLARE
  parent_amount integer;
  children_sum integer;
BEGIN
  IF NEW.parent_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT total_price_cents INTO parent_amount
  FROM public.ii_receipt_items
  WHERE id = NEW.parent_item_id;

  IF parent_amount IS NULL THEN
    RAISE EXCEPTION 'Split parent item not found or has no total_price_cents';
  END IF;

  SELECT COALESCE(SUM(total_price_cents), 0) INTO children_sum
  FROM public.ii_receipt_items
  WHERE parent_item_id = NEW.parent_item_id
    AND id != NEW.id;

  children_sum := children_sum + COALESCE(NEW.total_price_cents, 0);

  IF children_sum != parent_amount THEN
    RAISE EXCEPTION 'Split item invariant violated: children sum (% cents) != parent amount (% cents)',
      children_sum, parent_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_ii_split_invariant
  BEFORE INSERT OR UPDATE ON public.ii_receipt_items
  FOR EACH ROW
  WHEN (NEW.parent_item_id IS NOT NULL)
  EXECUTE FUNCTION public.validate_ii_split_item_invariant();

CREATE OR REPLACE FUNCTION public.mark_ii_parent_as_split()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_item_id IS NOT NULL THEN
    UPDATE public.ii_receipt_items
    SET is_split_original = true
    WHERE id = NEW.parent_item_id
      AND is_split_original = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_mark_ii_parent_split
  AFTER INSERT ON public.ii_receipt_items
  FOR EACH ROW
  WHEN (NEW.parent_item_id IS NOT NULL)
  EXECUTE FUNCTION public.mark_ii_parent_as_split();

CREATE OR REPLACE FUNCTION public.split_ii_receipt_item(
  p_item_id uuid,
  p_splits jsonb
)
RETURNS TABLE (child_id uuid) AS $$
DECLARE
  parent_record public.ii_receipt_items%ROWTYPE;
  split_record jsonb;
  total_split_amount integer := 0;
  new_child_id uuid;
BEGIN
  SELECT * INTO parent_record
  FROM public.ii_receipt_items
  WHERE id = p_item_id;

  IF parent_record.id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  IF parent_record.is_split_original THEN
    RAISE EXCEPTION 'Item has already been split';
  END IF;

  FOR split_record IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    total_split_amount := total_split_amount + (split_record->>'amount_cents')::integer;
  END LOOP;

  IF total_split_amount != parent_record.total_price_cents THEN
    RAISE EXCEPTION 'Split amounts (% cents) do not sum to parent amount (% cents)',
      total_split_amount, parent_record.total_price_cents;
  END IF;

  FOR split_record IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO public.ii_receipt_items (
      receipt_id, user_id, business_id, name, quantity, unit_price_cents,
      total_price_cents, category, tax_category, classification, project_id,
      parent_item_id, split_ratio, notes
    )
    VALUES (
      parent_record.receipt_id, parent_record.user_id, parent_record.business_id,
      parent_record.name || ' (split)', 1,
      (split_record->>'amount_cents')::integer,
      (split_record->>'amount_cents')::integer,
      parent_record.category,
      COALESCE(split_record->>'tax_category', parent_record.tax_category),
      split_record->>'classification',
      (split_record->>'project_id')::uuid,
      p_item_id,
      (split_record->>'amount_cents')::numeric / parent_record.total_price_cents,
      split_record->>'notes'
    )
    RETURNING id INTO new_child_id;

    child_id := new_child_id;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. EMAIL INGESTION
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_forwarding_email_sequences (
  initials text PRIMARY KEY,
  next_number integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ii_forwarding_email_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_ii_forwarding_email(
  p_business_id uuid,
  p_first_name text,
  p_last_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_initials text;
  v_number integer;
  v_email text;
  v_attempts integer := 0;
  v_max_attempts integer := 10;
BEGIN
  v_initials := UPPER(LEFT(p_first_name, 1));

  IF p_last_name IS NOT NULL AND LENGTH(p_last_name) > 0 THEN
    v_initials := v_initials || UPPER(LEFT(p_last_name, 1));
  END IF;

  LOOP
    v_attempts := v_attempts + 1;

    IF v_attempts > v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique II email after % attempts', v_max_attempts;
    END IF;

    INSERT INTO public.ii_forwarding_email_sequences (initials, next_number)
    VALUES (v_initials, 2)
    ON CONFLICT (initials)
    DO UPDATE SET
      next_number = ii_forwarding_email_sequences.next_number + 1,
      updated_at = now()
    RETURNING next_number - 1 INTO v_number;

    v_email := v_initials || v_number::text || '@2itm.com';

    BEGIN
      UPDATE public.businesses
      SET ii_forwarding_email = v_email
      WHERE id = p_business_id
        AND ii_forwarding_email IS NULL;

      IF FOUND THEN
        RETURN v_email;
      ELSE
        SELECT ii_forwarding_email INTO v_email
        FROM public.businesses
        WHERE id = p_business_id;

        RETURN v_email;
      END IF;
    EXCEPTION
      WHEN unique_violation THEN
        CONTINUE;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_ii_forwarding_email(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.regenerate_ii_forwarding_email(
  p_business_id uuid,
  p_first_name text,
  p_last_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_email text;
BEGIN
  UPDATE public.businesses
  SET ii_forwarding_email = NULL
  WHERE id = p_business_id;

  v_new_email := public.generate_ii_forwarding_email(p_business_id, p_first_name, p_last_name);
  RETURN v_new_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.regenerate_ii_forwarding_email(uuid, text, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.ii_inbound_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  from_email text NOT NULL,
  to_email text NOT NULL,
  subject text,
  attachment_count integer DEFAULT 0,
  receipts_created integer DEFAULT 0,
  received_at timestamptz DEFAULT now(),
  message_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'partial', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ii_inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ii_inbound_emails_business_id ON public.ii_inbound_emails(business_id);
CREATE INDEX IF NOT EXISTS idx_ii_inbound_emails_status ON public.ii_inbound_emails(status);

CREATE INDEX IF NOT EXISTS idx_ii_inbound_emails_message_id
  ON public.ii_inbound_emails(business_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ii_receipts_email_message_id
  ON public.ii_receipts(email_message_id)
  WHERE email_message_id IS NOT NULL;

CREATE POLICY "ii_inbound_emails_select" ON public.ii_inbound_emails
  FOR SELECT USING (has_business_access(business_id));

-- Helper: resolve forwarding email to business + user
CREATE OR REPLACE FUNCTION public.resolve_ii_forwarding_email(
  p_email text
)
RETURNS TABLE(business_id uuid, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id AS business_id, bm.user_id
  FROM businesses b
  JOIN business_members bm ON bm.business_id = b.id AND bm.status = 'active'
  WHERE b.ii_forwarding_email = LOWER(TRIM(p_email))
  LIMIT 1;
END;
$$;

-- ============================================
-- 11. LIFECYCLE: WARRANTIES, RETURNS, RECALLS
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.ii_receipts(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.ii_receipt_items(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  category text,
  manufacturer text,
  confidence numeric(3,2),
  is_manually_edited boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ii_warranties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ii_warranties_select" ON public.ii_warranties
  FOR SELECT USING (has_business_access(business_id));
CREATE POLICY "ii_warranties_insert" ON public.ii_warranties
  FOR INSERT WITH CHECK (has_business_access(business_id));
CREATE POLICY "ii_warranties_update" ON public.ii_warranties
  FOR UPDATE USING (has_business_access(business_id));
CREATE POLICY "ii_warranties_delete" ON public.ii_warranties
  FOR DELETE USING (has_business_access(business_id));

CREATE INDEX idx_ii_warranties_receipt ON public.ii_warranties(receipt_id);
CREATE INDEX idx_ii_warranties_business ON public.ii_warranties(business_id);
CREATE INDEX idx_ii_warranties_end_date ON public.ii_warranties(end_date);

CREATE TABLE IF NOT EXISTS public.ii_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.ii_receipts(id) ON DELETE CASCADE,
  retailer_name text NOT NULL,
  policy_days integer NOT NULL,
  return_by date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'returned', 'expired')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ii_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ii_returns_select" ON public.ii_returns
  FOR SELECT USING (has_business_access(business_id));
CREATE POLICY "ii_returns_insert" ON public.ii_returns
  FOR INSERT WITH CHECK (has_business_access(business_id));
CREATE POLICY "ii_returns_update" ON public.ii_returns
  FOR UPDATE USING (has_business_access(business_id));
CREATE POLICY "ii_returns_delete" ON public.ii_returns
  FOR DELETE USING (has_business_access(business_id));

CREATE INDEX idx_ii_returns_receipt ON public.ii_returns(receipt_id);
CREATE INDEX idx_ii_returns_business ON public.ii_returns(business_id);
CREATE INDEX idx_ii_returns_return_by ON public.ii_returns(return_by);
CREATE INDEX idx_ii_returns_status ON public.ii_returns(status);

CREATE TABLE IF NOT EXISTS public.ii_recall_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.ii_receipts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'no_recalls', 'recalls_found', 'possible_recalls', 'error', 'rate_limited')),
  checked_at timestamptz NOT NULL DEFAULT now(),
  api_response jsonb,
  match_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.ii_recall_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ii_recall_checks_select" ON public.ii_recall_checks
  FOR SELECT USING (has_business_access(business_id));
CREATE POLICY "ii_recall_checks_insert" ON public.ii_recall_checks
  FOR INSERT WITH CHECK (has_business_access(business_id));

CREATE INDEX idx_ii_recall_checks_receipt ON public.ii_recall_checks(receipt_id);

CREATE TABLE IF NOT EXISTS public.ii_recall_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.ii_receipts(id) ON DELETE CASCADE,
  recall_check_id uuid REFERENCES public.ii_recall_checks(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  recall_id text,
  hazard text,
  remedy text,
  source_url text,
  confidence text DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved')),
  matched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ii_recall_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ii_recall_matches_select" ON public.ii_recall_matches
  FOR SELECT USING (has_business_access(business_id));
CREATE POLICY "ii_recall_matches_insert" ON public.ii_recall_matches
  FOR INSERT WITH CHECK (has_business_access(business_id));
CREATE POLICY "ii_recall_matches_update" ON public.ii_recall_matches
  FOR UPDATE USING (has_business_access(business_id));

CREATE INDEX idx_ii_recall_matches_receipt ON public.ii_recall_matches(receipt_id);
CREATE INDEX idx_ii_recall_matches_status ON public.ii_recall_matches(status);

CREATE TABLE IF NOT EXISTS public.ii_recall_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_category text NOT NULL,
  recall_id text NOT NULL UNIQUE,
  product_name text,
  hazard text,
  remedy text,
  source_url text,
  published_date date,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 12. EXPORT LOG
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_type text NOT NULL DEFAULT 'csv',
  receipt_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ii_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view business export logs"
  ON public.ii_export_log FOR SELECT
  USING (public.has_business_access(business_id));

CREATE POLICY "Users can insert export logs"
  ON public.ii_export_log FOR INSERT
  WITH CHECK (
    public.has_business_access(business_id)
    AND auth.uid() = user_id
  );

CREATE INDEX idx_ii_export_log_business ON public.ii_export_log(business_id);
CREATE INDEX idx_ii_export_log_created ON public.ii_export_log(business_id, created_at);

-- ============================================
-- 13. STORAGE BUCKET
-- ============================================
-- You need to create a 'receipts' storage bucket in the Supabase dashboard
-- (Storage > New bucket > name: "receipts", public: false)
-- Then run these policies:

-- NOTE: Run this AFTER creating the 'receipts' bucket in the dashboard.
-- Uncomment and run separately if needed:

/*
UPDATE storage.buckets
SET allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'application/pdf', 'text/html'
]
WHERE id = 'receipts';

CREATE POLICY "II users can upload to business folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY "II users can view business files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY "II users can update business files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY "II users can delete business files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'itemize-it'
      OR (storage.foldername(name))[1] = 'ii'
    )
    AND public.has_business_access((storage.foldername(name))[2]::uuid)
  );
*/

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.businesses IS 'Business entities (workspaces for expense tracking)';
COMMENT ON TABLE public.business_members IS 'Business membership with roles for team access';
COMMENT ON TABLE public.business_invitations IS 'Pending invitations to join a business';
COMMENT ON TABLE public.ii_receipts IS 'Receipts with AI extraction and classification';
COMMENT ON TABLE public.ii_receipt_items IS 'Receipt line items with business/personal classification';
COMMENT ON TABLE public.ii_projects IS 'Projects for grouping and tracking expenses';
COMMENT ON TABLE public.ii_classification_rules IS 'User-defined rules for auto-classifying expenses';
COMMENT ON TABLE public.ii_audit_events IS 'Audit trail for all data changes';
COMMENT ON TABLE public.ii_export_log IS 'Log of export actions for plan limit tracking';
COMMENT ON COLUMN public.businesses.tax_jurisdiction IS 'Tax jurisdiction: US (IRS Schedule C) or CA (CRA T2125)';
COMMENT ON COLUMN public.businesses.ii_forwarding_email IS 'Unique email for forwarding receipts (format: initials+number@2itm.com)';

-- ============================================
-- 14. SOFT DELETE & RETENTION
-- ============================================

ALTER TABLE public.ii_receipts
  ADD COLUMN IF NOT EXISTS soft_deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ii_receipts_soft_deleted
  ON public.ii_receipts(soft_deleted_at)
  WHERE soft_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ii_receipts_business_created
  ON public.ii_receipts(business_id, created_at);

-- Hide soft-deleted receipts from all normal queries
CREATE POLICY "Hide soft-deleted receipts"
  ON public.ii_receipts
  FOR SELECT
  USING (soft_deleted_at IS NULL);

-- Retention cleanup function (runs via pg_cron)
CREATE OR REPLACE FUNCTION public.enforce_receipt_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  biz RECORD;
  retention int;
  cutoff timestamptz;
  affected int;
BEGIN
  FOR biz IN
    SELECT id, plan_tier, limits_json
    FROM businesses
  LOOP
    retention := COALESCE(
      (biz.limits_json->>'retention_days')::int,
      CASE biz.plan_tier
        WHEN 'free'       THEN 90
        WHEN 'starter'    THEN 395
        WHEN 'pro'        THEN 760
        WHEN 'enterprise' THEN -1
        ELSE 90
      END
    );

    IF retention = -1 THEN
      CONTINUE;
    END IF;

    cutoff := now() - (retention || ' days')::interval;

    UPDATE ii_receipts
    SET soft_deleted_at = now()
    WHERE business_id = biz.id
      AND created_at < cutoff
      AND soft_deleted_at IS NULL;

    GET DIAGNOSTICS affected = ROW_COUNT;

    IF affected > 0 THEN
      RAISE LOG 'retention: soft-deleted % receipts for business %', affected, biz.id;
    END IF;
  END LOOP;
END;
$$;

-- Schedule retention cron (requires pg_cron extension enabled in dashboard)
-- Uncomment after enabling pg_cron:
-- SELECT cron.schedule('enforce-receipt-retention', '0 3 * * *', $$SELECT enforce_receipt_retention()$$);

-- ============================================
-- 15. STRIPE WEBHOOK IDEMPOTENCY
-- ============================================

CREATE TABLE IF NOT EXISTS public.ii_stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON public.ii_stripe_webhook_events(processed_at);

-- ============================================
-- 16. REALTIME
-- ============================================
-- Enable realtime for inbound emails (live status updates in UI)
-- Uncomment after confirming realtime is enabled on the project:
-- ALTER PUBLICATION supabase_realtime ADD TABLE ii_inbound_emails;
