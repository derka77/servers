/* Secure first-user data claim, per-user FASHN usage, and multi-profile support. */

-- The legacy profile table was hard-coded to id=1. Remove that single-profile constraint
-- and give future profiles safe generated integer IDs.
ALTER TABLE profile DROP CONSTRAINT IF EXISTS single_profile;
CREATE SEQUENCE IF NOT EXISTS profile_id_seq;
SELECT setval('profile_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM profile), 0), 1), true);
ALTER TABLE profile ALTER COLUMN id SET DEFAULT nextval('profile_id_seq');
CREATE UNIQUE INDEX IF NOT EXISTS profile_one_row_per_user ON profile (user_id) WHERE user_id IS NOT NULL;

-- One-time claim for the pre-auth single-user dataset. The function is deliberately
-- idempotent and refuses to run once any owned data exists.
CREATE OR REPLACE FUNCTION public.claim_orphaned_data()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  already_owned boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM garments WHERE user_id = uid
    UNION ALL SELECT 1 FROM outfits WHERE user_id = uid
    UNION ALL SELECT 1 FROM profile WHERE user_id = uid
    UNION ALL SELECT 1 FROM wear_log WHERE user_id = uid
    UNION ALL SELECT 1 FROM events WHERE user_id = uid
    UNION ALL SELECT 1 FROM tryon_results WHERE user_id = uid
    UNION ALL SELECT 1 FROM size_history WHERE user_id = uid
  ) INTO already_owned;

  IF already_owned THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM garments WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM outfits WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM profile WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM wear_log WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM events WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM tryon_results WHERE user_id IS NOT NULL
    UNION ALL SELECT 1 FROM size_history WHERE user_id IS NOT NULL
  ) THEN
    RETURN false;
  END IF;

  UPDATE garments SET user_id = uid WHERE user_id IS NULL;
  UPDATE outfits SET user_id = uid WHERE user_id IS NULL;
  UPDATE profile SET user_id = uid WHERE user_id IS NULL;
  UPDATE wear_log SET user_id = uid WHERE user_id IS NULL;
  UPDATE events SET user_id = uid WHERE user_id IS NULL;
  UPDATE tryon_results SET user_id = uid WHERE user_id IS NULL;
  UPDATE size_history SET user_id = uid WHERE user_id IS NULL;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_orphaned_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_orphaned_data() TO authenticated;

CREATE TABLE IF NOT EXISTS fashn_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_used integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fashn_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select_fashn_usage" ON fashn_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_fashn_usage" ON fashn_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_fashn_usage" ON fashn_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_fashn_usage" ON fashn_usage FOR DELETE TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON fashn_usage FROM anon;
