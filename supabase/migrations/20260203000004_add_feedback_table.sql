-- Add feedback table for user feedback submissions
-- Types: enhancement, bug, general

CREATE TABLE IF NOT EXISTS public.ii_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  feedback_type text NOT NULL CHECK (feedback_type IN ('enhancement', 'bug', 'general')),
  message text NOT NULL,
  
  -- Optional context
  page_url text,
  user_agent text,
  
  -- Status tracking
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ii_feedback_business ON public.ii_feedback(business_id);
CREATE INDEX idx_ii_feedback_user ON public.ii_feedback(user_id);
CREATE INDEX idx_ii_feedback_status ON public.ii_feedback(status);
CREATE INDEX idx_ii_feedback_type ON public.ii_feedback(feedback_type);

ALTER TABLE public.ii_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.ii_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create feedback
CREATE POLICY "Users can create feedback"
  ON public.ii_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_business_access(business_id)
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_ii_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ii_feedback_updated
  BEFORE UPDATE ON public.ii_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ii_feedback_updated_at();

COMMENT ON TABLE public.ii_feedback IS 'User feedback submissions (enhancements, bugs, general)';

