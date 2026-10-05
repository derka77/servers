ALTER TABLE profile ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'simplified' CHECK (display_mode IN ('simplified', 'complete'));
