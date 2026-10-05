/*
# Normalize garment color, season, and style values to internal English keys

1. Purpose
- Garments were saved with French color labels (e.g. "Bleu ciel", "Noir", "Violet")
  but the app's filter chips compare against the localized value for the current
  language. When the locale is EN or AR, the French stored values never match.
- This migration normalizes ALL color_primary and color_secondary values to the
  internal English keys from the clothing dictionary (e.g. "Light blue", "Black",
  "Purple"). Season values are already English ("all", "spring", etc.) but any
  French season labels are also normalized. Styles are already English keys.

2. Modified Tables
- `garments`: UPDATE only on color_primary, color_secondary, and season columns.
  No schema changes.

3. Security
- No changes to RLS or policies.

4. Important Notes
- Idempotent: rows already using English keys are unaffected.
- The mapping covers all 28 colors in the dictionary.
*/

-- Normalize color_primary
UPDATE garments SET color_primary = 'Black' WHERE color_primary = 'Noir';
UPDATE garments SET color_primary = 'White' WHERE color_primary = 'Blanc';
UPDATE garments SET color_primary = 'Cream' WHERE color_primary IN ('Écru / Crème', 'Écru', 'Crème');
UPDATE garments SET color_primary = 'Beige' WHERE color_primary = 'Beige';
UPDATE garments SET color_primary = 'Camel' WHERE color_primary = 'Camel';
UPDATE garments SET color_primary = 'Brown' WHERE color_primary = 'Marron';
UPDATE garments SET color_primary = 'Grey' WHERE color_primary = 'Gris';
UPDATE garments SET color_primary = 'Navy blue' WHERE color_primary IN ('Bleu marine', 'Marine');
UPDATE garments SET color_primary = 'Light blue' WHERE color_primary = 'Bleu ciel';
UPDATE garments SET color_primary = 'Red' WHERE color_primary = 'Rouge';
UPDATE garments SET color_primary = 'Burgundy' WHERE color_primary = 'Bordeaux';
UPDATE garments SET color_primary = 'Pink' WHERE color_primary = 'Rose';
UPDATE garments SET color_primary = 'Blush pink' WHERE color_primary = 'Rose poudré';
UPDATE garments SET color_primary = 'Green' WHERE color_primary = 'Vert';
UPDATE garments SET color_primary = 'Emerald green' WHERE color_primary = 'Vert émeraude';
UPDATE garments SET color_primary = 'Khaki' WHERE color_primary = 'Kaki';
UPDATE garments SET color_primary = 'Yellow' WHERE color_primary = 'Jaune';
UPDATE garments SET color_primary = 'Mustard' WHERE color_primary = 'Moutarde';
UPDATE garments SET color_primary = 'Orange' WHERE color_primary = 'Orange';
UPDATE garments SET color_primary = 'Purple' WHERE color_primary = 'Violet';
UPDATE garments SET color_primary = 'Lavender' WHERE color_primary = 'Lavande';
UPDATE garments SET color_primary = 'Gold' WHERE color_primary = 'Doré';
UPDATE garments SET color_primary = 'Silver' WHERE color_primary = 'Argenté';
UPDATE garments SET color_primary = 'Multicolor' WHERE color_primary = 'Multicolore';
UPDATE garments SET color_primary = 'Printed' WHERE color_primary IN ('Imprimé / Motifs', 'Imprimé', 'Motifs');
UPDATE garments SET color_primary = 'Floral' WHERE color_primary = 'Fleuri';
UPDATE garments SET color_primary = 'Striped' WHERE color_primary = 'Rayé';
UPDATE garments SET color_primary = 'Leopard print' WHERE color_primary = 'Léopard';

-- Normalize color_secondary (same mapping)
UPDATE garments SET color_secondary = 'Black' WHERE color_secondary = 'Noir';
UPDATE garments SET color_secondary = 'White' WHERE color_secondary = 'Blanc';
UPDATE garments SET color_secondary = 'Cream' WHERE color_secondary IN ('Écru / Crème', 'Écru', 'Crème');
UPDATE garments SET color_secondary = 'Beige' WHERE color_secondary = 'Beige';
UPDATE garments SET color_secondary = 'Camel' WHERE color_secondary = 'Camel';
UPDATE garments SET color_secondary = 'Brown' WHERE color_secondary = 'Marron';
UPDATE garments SET color_secondary = 'Grey' WHERE color_secondary = 'Gris';
UPDATE garments SET color_secondary = 'Navy blue' WHERE color_secondary IN ('Bleu marine', 'Marine');
UPDATE garments SET color_secondary = 'Light blue' WHERE color_secondary = 'Bleu ciel';
UPDATE garments SET color_secondary = 'Red' WHERE color_secondary = 'Rouge';
UPDATE garments SET color_secondary = 'Burgundy' WHERE color_secondary = 'Bordeaux';
UPDATE garments SET color_secondary = 'Pink' WHERE color_secondary = 'Rose';
UPDATE garments SET color_secondary = 'Blush pink' WHERE color_secondary = 'Rose poudré';
UPDATE garments SET color_secondary = 'Green' WHERE color_secondary = 'Vert';
UPDATE garments SET color_secondary = 'Emerald green' WHERE color_secondary = 'Vert émeraude';
UPDATE garments SET color_secondary = 'Khaki' WHERE color_secondary = 'Kaki';
UPDATE garments SET color_secondary = 'Yellow' WHERE color_secondary = 'Jaune';
UPDATE garments SET color_secondary = 'Mustard' WHERE color_secondary = 'Moutarde';
UPDATE garments SET color_secondary = 'Orange' WHERE color_secondary = 'Orange';
UPDATE garments SET color_secondary = 'Purple' WHERE color_secondary = 'Violet';
UPDATE garments SET color_secondary = 'Lavender' WHERE color_secondary = 'Lavande';
UPDATE garments SET color_secondary = 'Gold' WHERE color_secondary = 'Doré';
UPDATE garments SET color_secondary = 'Silver' WHERE color_secondary = 'Argenté';
UPDATE garments SET color_secondary = 'Multicolor' WHERE color_secondary = 'Multicolore';
UPDATE garments SET color_secondary = 'Printed' WHERE color_secondary IN ('Imprimé / Motifs', 'Imprimé', 'Motifs');
UPDATE garments SET color_secondary = 'Floral' WHERE color_secondary = 'Fleuri';
UPDATE garments SET color_secondary = 'Striped' WHERE color_secondary = 'Rayé';
UPDATE garments SET color_secondary = 'Leopard print' WHERE color_secondary = 'Léopard';

-- Normalize season (French → English key)
UPDATE garments SET season = 'all' WHERE season IN ('Toutes saisons', 'كل المواسم');
UPDATE garments SET season = 'spring' WHERE season IN ('Printemps', 'الربيع');
UPDATE garments SET season = 'summer' WHERE season IN ('Été', 'الصيف');
UPDATE garments SET season = 'autumn' WHERE season IN ('Automne', 'الخريف');
UPDATE garments SET season = 'winter' WHERE season IN ('Hiver', 'الشتاء');
