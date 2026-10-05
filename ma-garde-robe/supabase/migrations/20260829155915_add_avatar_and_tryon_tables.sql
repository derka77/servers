/*
# Add avatar support and try-on results

1. Modified Tables
- `profile`: add `avatar_url` (text) to store the user's full-body avatar photo URL.

2. New Tables
- `tryon_results`: stores virtual try-on results
  - `id` (uuid, primary key)
  - `garment_id` (uuid, FK to garments, ON DELETE CASCADE)
  - `garment_name` (text, denormalized for display)
  - `garment_photo_url` (text, the garment image sent to FASHN)
  - `avatar_url` (text, the model image sent to FASHN)
  - `result_url` (text, the generated try-on image URL from FASHN CDN)
  - `status` (text: pending/completed/failed)
  - `error` (text, nullable)
  - `credits_used` (integer, default 1)
  - `created_at` (timestamptz)

3. Security
- Enable RLS on tryon_results.
- Single-tenant (no auth): allow anon + authenticated full CRUD.
- profile table already has RLS enabled; avatar_url is covered by existing policies.
*/

ALTER TABLE profile ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

CREATE TABLE IF NOT EXISTS tryon_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id uuid REFERENCES garments(id) ON DELETE CASCADE,
  garment_name text NOT NULL DEFAULT '',
  garment_photo_url text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  result_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  error text,
  credits_used integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tryon_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tryon" ON tryon_results;
CREATE POLICY "anon_select_tryon" ON tryon_results FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tryon" ON tryon_results;
CREATE POLICY "anon_insert_tryon" ON tryon_results FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tryon" ON tryon_results;
CREATE POLICY "anon_update_tryon" ON tryon_results FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tryon" ON tryon_results;
CREATE POLICY "anon_delete_tryon" ON tryon_results FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tryon_results_created_at ON tryon_results (created_at DESC);
