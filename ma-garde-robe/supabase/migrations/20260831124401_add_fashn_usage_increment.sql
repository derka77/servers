CREATE OR REPLACE FUNCTION public.increment_fashn_usage(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO fashn_usage (user_id, credits_used, updated_at)
  VALUES (p_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET credits_used = fashn_usage.credits_used + 1,
        updated_at = now()
  RETURNING credits_used;
$$;
REVOKE ALL ON FUNCTION public.increment_fashn_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_fashn_usage(uuid) TO service_role;
