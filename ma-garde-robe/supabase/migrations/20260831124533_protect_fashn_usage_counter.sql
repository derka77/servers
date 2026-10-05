REVOKE INSERT, UPDATE, DELETE ON fashn_usage FROM authenticated;
GRANT SELECT ON fashn_usage TO authenticated;
DROP POLICY IF EXISTS "owner_insert_fashn_usage" ON fashn_usage;
DROP POLICY IF EXISTS "owner_update_fashn_usage" ON fashn_usage;
DROP POLICY IF EXISTS "owner_delete_fashn_usage" ON fashn_usage;
