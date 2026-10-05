CREATE OR REPLACE FUNCTION public.claim_orphaned_data()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  uid uuid := auth.uid();
  already_owned boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM garments WHERE user_id = uid
    UNION ALL SELECT 1 FROM outfits WHERE user_id = uid
    UNION ALL SELECT 1 FROM profile WHERE user_id = uid
    UNION ALL SELECT 1 FROM wear_log WHERE user_id = uid
    UNION ALL SELECT 1 FROM events WHERE user_id = uid
    UNION ALL SELECT 1 FROM tryon_results WHERE user_id = uid
    UNION ALL SELECT 1 FROM size_history WHERE user_id = uid
  ) INTO already_owned;
  IF already_owned THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM garments WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM outfits WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM profile WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM wear_log WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM events WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM tryon_results WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM size_history WHERE user_id IS NOT NULL
  ) THEN RETURN false; END IF;

  UPDATE storage.objects
  SET name = uid::text || '/' || name
  WHERE bucket_id = 'garments' AND name NOT LIKE '%/%';

  UPDATE garments SET
    user_id = uid,
    photo_url = CASE WHEN photo_url IS NULL OR photo_url = '' THEN photo_url
      ELSE replace(photo_url, '/garments/', '/garments/' || uid::text || '/') END
  WHERE user_id IS NULL;
  UPDATE outfits SET user_id = uid WHERE user_id IS NULL;
  UPDATE profile SET
    user_id = uid,
    avatar_url = CASE WHEN avatar_url IS NULL OR avatar_url = '' THEN avatar_url
      ELSE replace(avatar_url, '/garments/', '/garments/' || uid::text || '/') END,
    avatar_optimized_url = CASE WHEN avatar_optimized_url IS NULL OR avatar_optimized_url = '' THEN avatar_optimized_url
      ELSE replace(avatar_optimized_url, '/garments/', '/garments/' || uid::text || '/') END
  WHERE user_id IS NULL;
  UPDATE wear_log SET user_id = uid WHERE user_id IS NULL;
  UPDATE events SET user_id = uid WHERE user_id IS NULL;
  UPDATE tryon_results SET user_id = uid WHERE user_id IS NULL;
  UPDATE size_history SET user_id = uid WHERE user_id IS NULL;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_orphaned_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_orphaned_data() TO authenticated;
