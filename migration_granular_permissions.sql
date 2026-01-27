-- Insert 'manage_*' permissions for all roles
-- Convention: manage_[feature] controls Create/Edit/Delete

-- 1. Pimpinan & Super Admin (Full Access)
INSERT INTO role_permissions (role, permission_key, is_enabled)
SELECT role, 'manage_' || split_part(permission_key, '_', 2) as new_key, true
FROM role_permissions
WHERE (role = 'pimpinan' OR role = 'super_admin')
AND permission_key LIKE 'view_%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- 2. Staff (Restricted Access by Default)
-- We'll give 'manage' access only to features they can currently Create (Requests, Quotations, PO, Invoices, etc.)
-- View Only features: Balances, Tracking (Staff can view but not manage)

-- Grant manage access for operational features
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('staff', 'manage_requests', true),
('staff', 'manage_quotations', true),
('staff', 'manage_purchase_orders', true),
('staff', 'manage_customers', true),
('staff', 'manage_vendors', true),
('staff', 'manage_internal_letters', true),
('staff', 'manage_invoices', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Explicitly deny manage access for view-only or hidden features (Balances, Cost Mgmt, Company, Team, Tracking)
INSERT INTO role_permissions (role, permission_key, is_enabled) VALUES
('staff', 'manage_balances', false),
('staff', 'manage_customer_cost_management', false),
('staff', 'manage_tracking', false),
('staff', 'manage_company', false),
('staff', 'manage_team', false)
ON CONFLICT (role, permission_key) DO NOTHING;
