REVOKE EXECUTE ON FUNCTION public.claim_orphaned_data() FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_orphaned_data() TO service_role;
