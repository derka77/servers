/*
# Add is_draft column to garments

## Purpose
Supports the "batch upload" (ajout en rafale) feature. When a user uploads
multiple photos at once, each photo creates a draft garment (is_draft = true).
Drafts are visible in the wardrobe with a "À compléter" badge but are excluded
from the outfit composer, daily outfit suggestions, and stylist recommendations
until the user completes them (is_draft → false).

## Changes
1. New column on `garments`:
   - `is_draft` (boolean, NOT NULL, DEFAULT false) — whether the garment is
     a draft awaiting completion.

## Security
- RLS is already enabled on `garments`. No policy changes needed — existing
  policies cover the new column automatically since it's on the same table.
*/

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
