/*
# Create events table

## Purpose
Social loop for the wear log: users can track upcoming events (weddings, parties,
gatherings), prepare an outfit in advance, and after the event mark it as worn —
which logs all outfit pieces into wear_log with the event's date, occasion and circle.

## New Table: events
- id (uuid, PK)
- name (text, NOT NULL) — e.g. "Mariage de Fatima"
- date (date, NOT NULL) — the event date
- occasion (text) — one of the 12 existing occasion values from wear_log
- circle (text) — free text, with suggestions from existing wear_log circles
- outfit_id (uuid, nullable, FK to outfits) — associated outfit
- status (text, NOT NULL, DEFAULT 'upcoming') — 'upcoming' | 'past' | 'worn'
- note (text) — optional note
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

## Security
- RLS enabled on events.
- Single-tenant (no auth): policies allow anon + authenticated full CRUD.
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  occasion text,
  circle text DEFAULT '',
  outfit_id uuid REFERENCES outfits(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'upcoming',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE
  TO anon, authenticated USING (true);
