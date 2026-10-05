/*
# Add is_demo column to garments

1. Changes
- Add `is_demo` boolean column to `garments`, default false.
- Existing rows get is_demo = false (personal pieces).
- Demo pieces inserted by the generator will set is_demo = true.
2. Security
- No policy changes — existing RLS policies already cover the column.
3. Notes
- The `wardrobe` column (already present) is kept for backward compatibility
  but the app now uses `is_demo` to distinguish demo vs personal pieces.
- The regenerate function deletes only rows WHERE is_demo = true.
*/

ALTER TABLE garments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Backfill: any existing demo wardrobe rows become is_demo = true
UPDATE garments SET is_demo = true WHERE wardrobe = 'demo';
