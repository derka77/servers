/*
# Create wardrobe inventory tables (single-tenant, no auth)

1. New Tables
- `garments`: stores each clothing item with photo URL, name, category, size, colors, style, season, brand, notes, favorite flag
- `outfits`: saved outfit suggestions (a named combination of garments)
- `outfit_items`: junction table linking outfits to garments (many-to-many)
- `profile`: single-row table storing the user's current size and shoe size
- `size_history`: history of size changes over time

2. Storage
- Creates a public storage bucket `garments` for clothing photos

3. Security
- RLS enabled on all tables
- CRUD policies for anon + authenticated (single-user app, no auth yet)
- Storage bucket policies for public read/write

4. Important Notes
- No user_id columns — single-tenant app, auth to be added later
- profile table uses a fixed id = 1 convention for the single user
- size_history tracks changes to current_size and current_shoe_size
*/

-- Create garments table
CREATE TABLE IF NOT EXISTS garments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'tops',
  size text DEFAULT '',
  color_primary text DEFAULT '',
  color_secondary text DEFAULT '',
  styles text[] DEFAULT '{}',
  season text DEFAULT 'all',
  brand text DEFAULT '',
  notes text DEFAULT '',
  favorite boolean NOT NULL DEFAULT false,
  photo_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create outfits table (saved outfit suggestions)
CREATE TABLE IF NOT EXISTS outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Tenue',
  theme text DEFAULT '',
  garment_ids uuid[] DEFAULT '{}',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create profile table (single row, id = 1)
CREATE TABLE IF NOT EXISTS profile (
  id integer PRIMARY KEY DEFAULT 1,
  current_size text DEFAULT '',
  current_shoe_size text DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_profile CHECK (id = 1)
);

-- Create size_history table
CREATE TABLE IF NOT EXISTS size_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size text NOT NULL,
  shoe_size text DEFAULT '',
  changed_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_history ENABLE ROW LEVEL SECURITY;

-- Garments policies (anon + authenticated, single-tenant)
DROP POLICY IF EXISTS "anon_select_garments" ON garments;
CREATE POLICY "anon_select_garments" ON garments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_garments" ON garments;
CREATE POLICY "anon_insert_garments" ON garments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_garments" ON garments;
CREATE POLICY "anon_update_garments" ON garments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_garments" ON garments;
CREATE POLICY "anon_delete_garments" ON garments FOR DELETE
  TO anon, authenticated USING (true);

-- Outfits policies
DROP POLICY IF EXISTS "anon_select_outfits" ON outfits;
CREATE POLICY "anon_select_outfits" ON outfits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_outfits" ON outfits;
CREATE POLICY "anon_insert_outfits" ON outfits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_outfits" ON outfits;
CREATE POLICY "anon_update_outfits" ON outfits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_outfits" ON outfits;
CREATE POLICY "anon_delete_outfits" ON outfits FOR DELETE
  TO anon, authenticated USING (true);

-- Profile policies
DROP POLICY IF EXISTS "anon_select_profile" ON profile;
CREATE POLICY "anon_select_profile" ON profile FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_profile" ON profile;
CREATE POLICY "anon_insert_profile" ON profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_profile" ON profile;
CREATE POLICY "anon_update_profile" ON profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Size history policies
DROP POLICY IF EXISTS "anon_select_size_history" ON size_history;
CREATE POLICY "anon_select_size_history" ON size_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_size_history" ON size_history;
CREATE POLICY "anon_insert_size_history" ON size_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_size_history" ON size_history;
CREATE POLICY "anon_delete_size_history" ON size_history FOR DELETE
  TO anon, authenticated USING (true);

-- Insert default profile row if not exists
INSERT INTO profile (id, current_size, current_shoe_size)
VALUES (1, '', '')
ON CONFLICT (id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_garments_category ON garments(category);
CREATE INDEX IF NOT EXISTS idx_garments_favorite ON garments(favorite);
CREATE INDEX IF NOT EXISTS idx_garments_created_at ON garments(created_at DESC);

-- Create storage bucket for garment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('garments', 'garments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for garments bucket
DROP POLICY IF EXISTS "anon_upload_garments" ON storage.objects;
CREATE POLICY "anon_upload_garments" ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'garments');

DROP POLICY IF EXISTS "anon_read_garments" ON storage.objects;
CREATE POLICY "anon_read_garments" ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'garments');

DROP POLICY IF EXISTS "anon_delete_garments_storage" ON storage.objects;
CREATE POLICY "anon_delete_garments_storage" ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'garments');

DROP POLICY IF EXISTS "anon_update_garments_storage" ON storage.objects;
CREATE POLICY "anon_update_garments_storage" ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'garments') WITH CHECK (bucket_id = 'garments');
