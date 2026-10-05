/*
# Add wardrobe column to garments

1. Modified Tables
- `garments`: add `wardrobe` text column, default 'personal'
- All existing rows set to 'personal' so current data is untouched
2. Notes
- Values: 'personal' (default, user's real wardrobe) or 'demo' (virtual demonstration pieces)
- The frontend will filter all queries by this column to isolate the two wardrobes
- No RLS changes needed — the column is readable/writable by the same existing policies
*/

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS wardrobe text NOT NULL DEFAULT 'personal';

-- Ensure all existing rows are 'personal'
UPDATE garments SET wardrobe = 'personal' WHERE wardrobe IS NULL OR wardrobe = '';
