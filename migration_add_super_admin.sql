-- Seed default permissions for Super Admin (Full Access)
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('super_admin', 'view_requests', true),
('super_admin', 'view_balances', true),
('super_admin', 'view_quotations', true),
('super_admin', 'view_purchase_orders', true),
('super_admin', 'view_customers', true),
('super_admin', 'view_vendors', true),
('super_admin', 'view_customer_cost_management', true),
('super_admin', 'view_internal_letters', true),
('super_admin', 'view_tracking', true),
('super_admin', 'view_invoices', true),
('super_admin', 'view_company', true),
('super_admin', 'view_team', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Ensure RLS policy allows super_admin to manage permissions (just like pimpinan)
DROP POLICY IF EXISTS "Pimpinan can manage permissions" ON role_permissions;

CREATE POLICY "Admins can manage permissions" ON role_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.email = auth.email()
            AND (team_members.role = 'pimpinan' OR team_members.role = 'super_admin')
        )
    );
