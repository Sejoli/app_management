-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role TEXT NOT NULL, -- 'pimpinan', 'staff'
    permission_key TEXT NOT NULL, -- e.g., 'view_requests'
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(role, permission_key)
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
-- Pimpinan can read and update all permissions
CREATE POLICY "Pimpinan can manage permissions" ON role_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM team_members
            WHERE team_members.email = auth.email()
            AND team_members.role = 'pimpinan'
        )
    );

-- Staff can only read permissions (to know what they can access)
CREATE POLICY "Staff can read permissions" ON role_permissions
    FOR SELECT
    USING (true); -- Public read is fine for permissions, simplifies logic on client

-- Seed default permissions
-- List of features: requests, balances, quotations, purchase_orders, customers, vendors, cost_management, internal_letters, tracking, invoices, company, team

-- Default Pimpinan (All Access) - technically not needed if we code pimpinan as bypass, but good for consistency
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('pimpinan', 'view_requests', true),
('pimpinan', 'view_balances', true),
('pimpinan', 'view_quotations', true),
('pimpinan', 'view_purchase_orders', true),
('pimpinan', 'view_customers', true),
('pimpinan', 'view_vendors', true),
('pimpinan', 'view_customer_cost_management', true),
('pimpinan', 'view_internal_letters', true),
('pimpinan', 'view_tracking', true),
('pimpinan', 'view_invoices', true),
('pimpinan', 'view_company', true),
('pimpinan', 'view_team', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Default Staff (Restricted)
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('staff', 'view_requests', true),
('staff', 'view_balances', true), -- View only
('staff', 'view_quotations', true),
('staff', 'view_purchase_orders', true),
('staff', 'view_customers', true),
('staff', 'view_vendors', true),
('staff', 'view_customer_cost_management', false), -- No access
('staff', 'view_internal_letters', true),
('staff', 'view_tracking', true),
('staff', 'view_invoices', true),
('staff', 'view_company', false), -- No access
('staff', 'view_team', false) -- No access
ON CONFLICT (role, permission_key) DO NOTHING;
