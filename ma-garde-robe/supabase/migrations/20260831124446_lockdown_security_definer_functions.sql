REVOKE EXECUTE ON FUNCTION public.claim_orphaned_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_orphaned_data() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_fashn_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_fashn_usage(uuid) TO service_role;
