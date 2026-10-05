/*
# Add detailed profile measurements and garment material

1. Modified Tables
- `profile`: adds optional body measurements for a more complete fit profile:
  - `height_cm` for height in centimeters
  - `weight_kg` for weight in kilograms
  - `bust_cm` for chest/bust circumference
  - `waist_cm` for waist circumference
  - `hip_cm` for hip circumference
  - `shoulder_cm` for shoulder width
  - `inseam_cm` for inside-leg length
- `garments`: adds `material` so clothing can be catalogued with the dictionary's fabric options.

2. Security
- No new tables or policies are introduced.
- Existing RLS policies remain unchanged and continue to protect the single-tenant profile and garments tables according to the app's current no-sign-in model.

3. Important Notes
- All new fields are optional and default to an empty string, so existing data remains valid.
- No existing rows or columns are removed, renamed, or changed in type.
- The application stores measurements as text to support values such as `M`, `38`, or `95 cm` when needed.
*/

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS height_cm text DEFAULT '',
  ADD COLUMN IF NOT EXISTS weight_kg text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bust_cm text DEFAULT '',
  ADD COLUMN IF NOT EXISTS waist_cm text DEFAULT '',
  ADD COLUMN IF NOT EXISTS hip_cm text DEFAULT '',
  ADD COLUMN IF NOT EXISTS shoulder_cm text DEFAULT '',
  ADD COLUMN IF NOT EXISTS inseam_cm text DEFAULT '';

ALTER TABLE garments
  ADD COLUMN IF NOT EXISTS material text DEFAULT '';
