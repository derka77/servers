/*
# Add garment status field

1. New Columns
- `garments.status` (text, NOT NULL, default 'available')
  Tracks the current availability of a garment:
  - 'available' — ready to wear (default)
  - 'needs_ironing' — needs ironing before use
  - 'at_cleaning' — at the dry cleaner / laundry
  - 'in_alteration' — being altered or repaired

2. Modified Tables
- `garments`: ADD COLUMN status TEXT NOT NULL DEFAULT 'available'
  All existing rows are set to 'available' by the default.

3. Security
- No changes to RLS or policies. Existing CRUD policies cover the new column.

4. Important Notes
- Idempotent: uses IF NOT EXISTS via DO block.
- No data loss: existing garments get 'available' automatically.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'garments' AND column_name = 'status'
  ) THEN
    ALTER TABLE garments ADD COLUMN status TEXT NOT NULL DEFAULT 'available';
  END IF;
END $$;

-- Ensure all existing rows are 'available' (in case column existed without default)
UPDATE garments SET status = 'available' WHERE status IS NULL OR status = '';
