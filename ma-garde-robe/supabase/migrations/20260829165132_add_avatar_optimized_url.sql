-- Add optimized avatar URL column to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS avatar_optimized_url text DEFAULT '';