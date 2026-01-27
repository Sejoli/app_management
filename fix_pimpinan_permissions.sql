-- Skrip untuk memastikan role 'pimpinan' memiliki semua izin akses secara default.
-- Jalankan ini SEBELUM menghapus hardcode bypass di kode frontend.

BEGIN;

-- 1. Pastikan role 'pimpinan' ada di tabel settings (jika Anda menggunakan pendekatan tabel terpisah, tapi kode frontend menggunakan string langsung, jadi ini opsional tapi bagus untuk konsistensi)

-- 2. Masukkan semua izin default untuk 'pimpinan'
-- Kita akan mengambil semua kunci unik dari fitur yang ada (requests, balances, dll)
-- dan memastikan 'pimpinan' punya 'view_' dan 'manage_' untuk semuanya.

INSERT INTO role_permissions (role, permission_key, is_enabled)
VALUES 
    -- Requests
    ('pimpinan', 'view_requests', true),
    ('pimpinan', 'manage_requests', true),
    
    -- Balances
    ('pimpinan', 'view_balances', true),
    ('pimpinan', 'manage_balances', true),
    
    -- Quotations
    ('pimpinan', 'view_quotations', true),
    ('pimpinan', 'manage_quotations', true),
    
    -- Purchase Orders
    ('pimpinan', 'view_purchase_orders', true),
    ('pimpinan', 'manage_purchase_orders', true),
    
    -- Customers
    ('pimpinan', 'view_customers', true),
    ('pimpinan', 'manage_customers', true),
    
    -- Vendors
    ('pimpinan', 'view_vendors', true),
    ('pimpinan', 'manage_vendors', true),
    
    -- Cost Management (Biaya)
    ('pimpinan', 'view_customer_cost_management', true),
    ('pimpinan', 'manage_customer_cost_management', true),
    
    -- Internal Letters (Pengajuan Belanja)
    ('pimpinan', 'view_internal_letters', true),
    ('pimpinan', 'manage_internal_letters', true),
    
    -- Tracking
    ('pimpinan', 'view_tracking', true),
    ('pimpinan', 'manage_tracking', true),
    
    -- Invoices
    ('pimpinan', 'view_invoices', true),
    ('pimpinan', 'manage_invoices', true),
    
    -- Company
    ('pimpinan', 'view_company', true),
    ('pimpinan', 'manage_company', true),
    
    -- Team / User Management
    ('pimpinan', 'view_team', true),
    ('pimpinan', 'manage_team', true)

ON CONFLICT (role, permission_key) 
DO UPDATE SET is_enabled = EXCLUDED.is_enabled;

COMMIT;

-- Verifikasi hasil
SELECT * FROM role_permissions WHERE role = 'pimpinan';
