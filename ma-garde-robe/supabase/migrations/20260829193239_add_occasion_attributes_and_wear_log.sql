/*
# Occasion attributes + Wear log

## Summary
Adds enriched garment attributes for occasion-based styling (modesty, formality, pattern, metallic, occasion_tags)
and creates a new `wear_log` table to track when/where garments and outfits were worn.

## New columns on `garments`
- `modesty` (text, nullable): "full_coverage" | "moderate" | "revealing" | null
- `formality` (text, nullable): "very_casual" | "casual" | "smart_casual" | "business" | "evening" | "ceremonial" | null
- `pattern` (text, default 'solid'): "solid" | "striped" | "floral" | "geometric" | "polka_dot" | "animal_print" | "embroidered" | "sequined" | "abstract" | "plaid"
- `metallic` (text, default 'none'): "none" | "gold" | "silver" | "mixed"
- `occasion_tags` (text[], default '{}'): array of occasion tags

All new fields are optional — existing garments get safe defaults and remain visible.

## New table `wear_log`
- `id` (uuid, primary key)
- `garment_id` (uuid, nullable, FK to garments ON DELETE CASCADE)
- `outfit_id` (uuid, nullable, FK to outfits ON DELETE CASCADE)
- `worn_date` (date, not null, default today)
- `occasion` (text, nullable): one of the occasion_tags values
- `event_name` (text, nullable): free-text event name (e.g. "Mariage de Fatima")
- `circle` (text, nullable): free-text audience/circle (e.g. "Famille Al-Thani")
- `note` (text, nullable): optional note
- `created_at` (timestamp, default now())

Either garment_id or outfit_id must be set (enforced by CHECK constraint).

## Security
- RLS enabled on `wear_log`.
- Single-tenant (no auth): policies allow anon + authenticated full CRUD.
*/

-- 1. Add enriched attributes to garments
ALTER TABLE garments ADD COLUMN IF NOT EXISTS modesty text;
ALTER TABLE garments ADD COLUMN IF NOT EXISTS formality text;
ALTER TABLE garments ADD COLUMN IF NOT EXISTS pattern text NOT NULL DEFAULT 'solid';
ALTER TABLE garments ADD COLUMN IF NOT EXISTS metallic text NOT NULL DEFAULT 'none';
ALTER TABLE garments ADD COLUMN IF NOT EXISTS occasion_tags text[] NOT NULL DEFAULT '{}';

-- 2. Create wear_log table
CREATE TABLE IF NOT EXISTS wear_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garment_id uuid REFERENCES garments(id) ON DELETE CASCADE,
  outfit_id uuid REFERENCES outfits(id) ON DELETE CASCADE,
  worn_date date NOT NULL DEFAULT CURRENT_DATE,
  occasion text,
  event_name text DEFAULT '',
  circle text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CHECK (
    (garment_id IS NOT NULL AND outfit_id IS NULL) OR
    (garment_id IS NULL AND outfit_id IS NOT NULL)
  )
);

ALTER TABLE wear_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wear_log" ON wear_log;
CREATE POLICY "anon_select_wear_log" ON wear_log FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wear_log" ON wear_log;
CREATE POLICY "anon_insert_wear_log" ON wear_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wear_log" ON wear_log;
CREATE POLICY "anon_update_wear_log" ON wear_log FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wear_log" ON wear_log;
CREATE POLICY "anon_delete_wear_log" ON wear_log FOR DELETE
  TO anon, authenticated USING (true);

-- 3. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wear_log_garment_id ON wear_log(garment_id);
CREATE INDEX IF NOT EXISTS idx_wear_log_outfit_id ON wear_log(outfit_id);
CREATE INDEX IF NOT EXISTS idx_wear_log_circle ON wear_log(circle);
CREATE INDEX IF NOT EXISTS idx_garments_occasion_tags ON garments USING GIN(occasion_tags);
