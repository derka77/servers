/*
# Reset invalid current_size value

1. Purpose
- The profile's current_size field was set to "162" (a body height value
  mistakenly entered before the field was converted to a dropdown).
- This resets it to empty so the user can select a proper clothing size (XS-XXL)
  from the new dropdown.

2. Modified Tables
- `profile`: UPDATE only, no schema changes.

3. Security
- No changes to RLS or policies.
*/

UPDATE profile SET current_size = '' WHERE id = 1 AND current_size = '162';
