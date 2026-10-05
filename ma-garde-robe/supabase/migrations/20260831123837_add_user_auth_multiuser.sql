/*
# Multi-user authentication migration

## Purpose
Transform the single-tenant app into a multi-user app with Supabase Auth.
Every row in every data table becomes owned by a user via `user_id`.
RLS policies are replaced: the `anon` policies are dropped entirely,
and only `authenticated` users can CRUD their own rows.

## Data preservation
Existing rows have `user_id = NULL`. We cannot know in advance which user will
claim them, so we leave them NULL for now. A follow-up migration (or the first
sign-up) will assign all NULL rows to the first registered user. The approach:
  1. Add `user_id` column (nullable, with DEFAULT auth.uid() for new inserts).
  2. Leave existing rows NULL temporarily.
  3. After the first user signs up, a one-time SQL block assigns all NULL
     rows to that user. This is handled by the app on first login.

## Tables modified (user_id added)
- garments: user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
- outfits: same
- profile: same
- wear_log: same
- events: same
- tryon_results: same
- size_history: same

## New table
- daily_outfit: stores the "outfit of the day" per user, replacing localStorage.
  Columns: id, user_id, date, slots_jsonb (garment IDs + metadata), created_at.

## Security changes
- ALL existing `anon_*` policies on public tables: DROPPED.
- New policies: `TO authenticated` with `auth.uid() = user_id` on every table.
- Storage: `anon_*` policies on `storage.objects` DROPPED, replaced with
  per-user policies that scope by path prefix `user_id/`.

## Important notes
1. `user_id` columns are nullable during transition (existing data).
2. DEFAULT auth.uid() ensures new inserts work even if the client omits user_id.
3. The daily_outfit table uses upsert by (user_id, date) for idempotent writes.
*/

-- ===== Add user_id to all data tables =====

ALTER TABLE garments ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE outfits ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE wear_log ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tryon_results ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE size_history ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- ===== Drop ALL existing anon policies on public tables =====

DROP POLICY IF EXISTS "anon_select_garments" ON garments;
DROP POLICY IF EXISTS "anon_insert_garments" ON garments;
DROP POLICY IF EXISTS "anon_update_garments" ON garments;
DROP POLICY IF EXISTS "anon_delete_garments" ON garments;

DROP POLICY IF EXISTS "anon_select_outfits" ON outfits;
DROP POLICY IF EXISTS "anon_insert_outfits" ON outfits;
DROP POLICY IF EXISTS "anon_update_outfits" ON outfits;
DROP POLICY IF EXISTS "anon_delete_outfits" ON outfits;

DROP POLICY IF EXISTS "anon_select_profile" ON profile;
DROP POLICY IF EXISTS "anon_insert_profile" ON profile;
DROP POLICY IF EXISTS "anon_update_profile" ON profile;
DROP POLICY IF EXISTS "anon_delete_profile" ON profile;

DROP POLICY IF EXISTS "anon_select_wear_log" ON wear_log;
DROP POLICY IF EXISTS "anon_insert_wear_log" ON wear_log;
DROP POLICY IF EXISTS "anon_update_wear_log" ON wear_log;
DROP POLICY IF EXISTS "anon_delete_wear_log" ON wear_log;

DROP POLICY IF EXISTS "anon_select_events" ON events;
DROP POLICY IF EXISTS "anon_insert_events" ON events;
DROP POLICY IF EXISTS "anon_update_events" ON events;
DROP POLICY IF EXISTS "anon_delete_events" ON events;

DROP POLICY IF EXISTS "anon_select_tryon" ON tryon_results;
DROP POLICY IF EXISTS "anon_insert_tryon" ON tryon_results;
DROP POLICY IF EXISTS "anon_update_tryon" ON tryon_results;
DROP POLICY IF EXISTS "anon_delete_tryon" ON tryon_results;

DROP POLICY IF EXISTS "anon_select_size_history" ON size_history;
DROP POLICY IF EXISTS "anon_insert_size_history" ON size_history;
DROP POLICY IF EXISTS "anon_delete_size_history" ON size_history;
DROP POLICY IF EXISTS "anon_update_size_history" ON size_history;

-- ===== Create owner-scoped RLS policies on all tables =====

-- garments
CREATE POLICY "owner_select_garments" ON garments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_garments" ON garments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_garments" ON garments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_garments" ON garments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- outfits
CREATE POLICY "owner_select_outfits" ON outfits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_outfits" ON outfits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_outfits" ON outfits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_outfits" ON outfits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- profile
CREATE POLICY "owner_select_profile" ON profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_profile" ON profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_profile" ON profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_profile" ON profile FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- wear_log
CREATE POLICY "owner_select_wear_log" ON wear_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_wear_log" ON wear_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_wear_log" ON wear_log FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_wear_log" ON wear_log FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- events
CREATE POLICY "owner_select_events" ON events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_events" ON events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_events" ON events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_events" ON events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- tryon_results
CREATE POLICY "owner_select_tryon" ON tryon_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_tryon" ON tryon_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_tryon" ON tryon_results FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_tryon" ON tryon_results FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- size_history
CREATE POLICY "owner_select_size_history" ON size_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_size_history" ON size_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_size_history" ON size_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_size_history" ON size_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== daily_outfit table =====

CREATE TABLE IF NOT EXISTS daily_outfit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  slots_jsonb jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE daily_outfit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_daily_outfit" ON daily_outfit FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner_insert_daily_outfit" ON daily_outfit FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update_daily_outfit" ON daily_outfit FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_delete_daily_outfit" ON daily_outfit FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== Storage: replace anon policies with per-user policies =====

DROP POLICY IF EXISTS "anon_read_garments" ON storage.objects;
DROP POLICY IF EXISTS "anon_upload_garments" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_garments_storage" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_garments_storage" ON storage.objects;

-- Per-user storage policies: files must be under path "{user_id}/..."
CREATE POLICY "user_read_own_files" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "user_upload_own_files" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text AND owner = auth.uid());

CREATE POLICY "user_update_own_files" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "user_delete_own_files" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'garments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ===== Revoke excess grants from anon role =====

REVOKE ALL ON garments FROM anon;
REVOKE ALL ON outfits FROM anon;
REVOKE ALL ON profile FROM anon;
REVOKE ALL ON wear_log FROM anon;
REVOKE ALL ON events FROM anon;
REVOKE ALL ON tryon_results FROM anon;
REVOKE ALL ON size_history FROM anon;
REVOKE ALL ON daily_outfit FROM anon;
