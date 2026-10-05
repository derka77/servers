/*
# Normalize garment category values to internal English keys

1. Purpose
- Garments saved before the dictionary update may store French/Arabic labels
  in the `category` column (e.g. "Hauts", "أقمصة") instead of the internal
  English keys used by the app (e.g. "tops", "dresses", "shoes").
- This migration normalizes ALL existing rows to use the internal English keys
  so that the Outfit Composer's category filter matches correctly.

2. Modified Tables
- `garments`: UPDATE only, no schema changes. Maps known French/Arabic labels
  to their English key equivalents. Rows already using English keys are untouched.

3. Security
- No changes to RLS or policies. Existing policies remain in effect.

4. Important Notes
- This is a data-only migration. No columns are added, removed, or renamed.
- The mapping covers all 8 categories: tops, bottoms, dresses, outerwear, shoes,
  accessories, bags, traditional.
- Idempotent: running it again has no effect on already-normalized rows.
*/

UPDATE garments SET category = 'dresses'
  WHERE category IN ('Robes', 'فساتين', 'robe', 'robes');
UPDATE garments SET category = 'tops'
  WHERE category IN ('Hauts', 'أقمصة', 'haut', 'hauts');
UPDATE garments SET category = 'bottoms'
  WHERE category IN ('Bas', 'بناطيل', 'bas', 'bottom');
UPDATE garments SET category = 'outerwear'
  WHERE category IN ('Vêtements d''extérieur', 'Vestements d''extérieur', 'ملابس خارجية', 'vestes', 'manteaux');
UPDATE garments SET category = 'shoes'
  WHERE category IN ('Chaussures', 'أحذية', 'chaussure');
UPDATE garments SET category = 'accessories'
  WHERE category IN ('Accessoires', 'إكسسوارات', 'accessoire');
UPDATE garments SET category = 'bags'
  WHERE category IN ('Sacs', 'حقائب', 'sac');
UPDATE garments SET category = 'traditional'
  WHERE category IN ('Tenues traditionnelles', 'ملابس تقليدية', 'traditionnel');
