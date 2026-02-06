-- ============================================================================
-- SECURITY HARDENING: Forwarding email RPC authorization + grants
--
-- Fixes cross-tenant alias takeover risk by enforcing membership checks inside
-- SECURITY DEFINER functions and restricting who can execute resolver RPCs.
-- ============================================================================

-- Recreate generate_ii_forwarding_email with explicit caller authorization.
CREATE OR REPLACE FUNCTION public.generate_ii_forwarding_email(
  p_business_id uuid,
  p_first_name text,
  p_last_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_initials text;
  v_number integer;
  v_email text;
  v_attempts integer := 0;
  v_max_attempts integer := 10;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id is required';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.business_members
      WHERE business_id = p_business_id
        AND user_id = auth.uid()
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_initials := UPPER(LEFT(TRIM(COALESCE(p_first_name, '')), 1));
  IF v_initials = '' THEN
    v_initials := 'U';
  END IF;

  IF p_last_name IS NOT NULL AND LENGTH(TRIM(p_last_name)) > 0 THEN
    v_initials := v_initials || UPPER(LEFT(TRIM(p_last_name), 1));
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

-- Recreate regenerate_ii_forwarding_email with explicit caller authorization.
CREATE OR REPLACE FUNCTION public.regenerate_ii_forwarding_email(
  p_business_id uuid,
  p_first_name text,
  p_last_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_email text;
BEGIN
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'p_business_id is required';
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.business_members
      WHERE business_id = p_business_id
        AND user_id = auth.uid()
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.businesses
  SET ii_forwarding_email = NULL
  WHERE id = p_business_id;

  v_new_email := public.generate_ii_forwarding_email(p_business_id, p_first_name, p_last_name);
  RETURN v_new_email;
END;
$$;

-- Recreate resolver RPC and restrict it to service-role callers only.
CREATE OR REPLACE FUNCTION public.resolve_ii_forwarding_email(
  p_email text
)
RETURNS TABLE(business_id uuid, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT b.id AS business_id, bm.user_id
  FROM businesses b
  JOIN business_members bm ON bm.business_id = b.id AND bm.status = 'active'
  WHERE b.ii_forwarding_email = LOWER(TRIM(p_email))
  LIMIT 1;
END;
$$;

-- Tighten execute grants (functions default to PUBLIC execute in Postgres).
REVOKE EXECUTE ON FUNCTION public.generate_ii_forwarding_email(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_ii_forwarding_email(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_ii_forwarding_email(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_ii_forwarding_email(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_ii_forwarding_email(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_ii_forwarding_email(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_ii_forwarding_email(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_ii_forwarding_email(text) TO service_role;
