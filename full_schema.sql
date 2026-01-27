-- CLIENT VENDOR HUB - FULL DATABASE SCHEMA
-- Generated: 2026-01-22
-- Target: PostgreSQL (Supabase)

-- ==========================================
-- 1. BASE CONFIGURATION & EXTENSIONS
-- ==========================================
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. BASE ENTITY TABLES
-- ==========================================

-- Company (Own Profile)
CREATE TABLE IF NOT EXISTS public.company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    npwp TEXT NOT NULL,
    logo_path TEXT,
    npwp_document_path TEXT,
    profile_document_path TEXT,
    bank_name TEXT,
    account_number TEXT,
    account_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Company Product Documents
CREATE TABLE IF NOT EXISTS public.company_product_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Team Members
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    birthplace TEXT NOT NULL,
    birthdate DATE NOT NULL,
    address TEXT NOT NULL,
    position TEXT NOT NULL,
    joining_date DATE, -- Added from patch
    photo_path TEXT, -- Added from patch
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Team Member Documents
CREATE TABLE IF NOT EXISTS public.team_member_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    office_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    email TEXT NOT NULL,
    npwp TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Customer PICs
CREATE TABLE IF NOT EXISTS public.customer_pics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Vendors
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    office_address TEXT NOT NULL,
    email TEXT NOT NULL,
    npwp TEXT NOT NULL,
    npwp_url TEXT, -- Added from migration
    products TEXT, -- Added from migration
    bank_name TEXT, -- Added from patch
    bank_account_number TEXT, -- Added from patch
    bank_account_holder TEXT, -- Added from patch
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Vendor PICs
CREATE TABLE IF NOT EXISTS public.vendor_pics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==========================================
-- 3. SETTINGS TABLES
-- ==========================================

-- Default Difficulty Settings (Global)
CREATE TABLE IF NOT EXISTS public.default_difficulty_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    difficulty_level TEXT NOT NULL UNIQUE,
    percentage NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Default Delivery Time Settings (Global)
CREATE TABLE IF NOT EXISTS public.default_delivery_time_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_category TEXT NOT NULL UNIQUE,
    percentage NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Default Payment Time Settings (Global)
CREATE TABLE IF NOT EXISTS public.default_payment_time_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_category TEXT NOT NULL,
    percentage NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Default Overall Cost Settings (Global)
CREATE TABLE IF NOT EXISTS public.default_overall_cost_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_category TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Customer Default Settings (Per Customer)
CREATE TABLE IF NOT EXISTS public.customer_default_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    margin_percentage NUMERIC NOT NULL DEFAULT 0,
    payment_category_id UUID REFERENCES public.default_payment_time_settings(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(customer_id)
);

-- ==========================================
-- 4. BUSINESS LOGIC CORE TABLES
-- ==========================================

-- Requests
CREATE TABLE IF NOT EXISTS public.requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id),
    request_date DATE NOT NULL DEFAULT CURRENT_DATE,
    request_code TEXT,
    title TEXT NOT NULL,
    letter_number TEXT NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_pic_id UUID NOT NULL REFERENCES public.customer_pics(id) ON DELETE CASCADE,
    submission_deadline DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Request Attachments
CREATE TABLE IF NOT EXISTS public.request_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Balances
CREATE TABLE IF NOT EXISTS public.balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    balance_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Balance Settings (Per Balance)
CREATE TABLE IF NOT EXISTS public.balance_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL UNIQUE REFERENCES public.balances(id),
    margin_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    payment_terms TEXT,
    ppn_percentage DECIMAL(5,2) NOT NULL DEFAULT 11,
    document_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    return_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Balance Vendor Settings
CREATE TABLE IF NOT EXISTS public.balance_vendor_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES public.balances(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    discount NUMERIC DEFAULT 0,
    dp_amount NUMERIC DEFAULT NULL,
    dp_percentage NUMERIC DEFAULT NULL,
    payment_terms TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(balance_id, vendor_id)
);

-- Balance Items
CREATE TABLE IF NOT EXISTS public.balance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES public.balances(id),
    balance_entry_id INTEGER NOT NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    vendor_spec TEXT,
    customer_spec TEXT,
    document_path TEXT,
    purchase_price DECIMAL(15,2) NOT NULL,
    qty DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    weight DECIMAL(10,2),
    shipping_vendor_group TEXT NOT NULL,
    shipping_customer_group TEXT NOT NULL,
    delivery_time TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    unit_selling_price DECIMAL(15,2),
    total_selling_price DECIMAL(15,2),
    position INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Balance Detail: Shipping Vendor MPA
CREATE TABLE IF NOT EXISTS public.shipping_vendor_mpa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES public.balances(id),
    group_name TEXT NOT NULL,
    cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(balance_id, group_name)
);

-- Balance Detail: Shipping MPA Customer
CREATE TABLE IF NOT EXISTS public.shipping_mpa_customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES public.balances(id),
    group_name TEXT NOT NULL,
    cost DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(balance_id, group_name)
);

-- Balance Detail: Difficulty Settings
CREATE TABLE IF NOT EXISTS public.difficulty_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    balance_id UUID NOT NULL REFERENCES public.balances(id),
    difficulty_level TEXT NOT NULL,
    percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(balance_id, difficulty_level)
);

-- Quotations
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    quotation_number TEXT NOT NULL UNIQUE,
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT DEFAULT 'partial order need re quotation',
    franco TEXT,
    term_of_payment TEXT,
    price_validity TEXT DEFAULT '7 days',
    status TEXT DEFAULT 'draft',
    last_follow_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Quotation Balances Junction
CREATE TABLE IF NOT EXISTS public.quotation_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    balance_id UUID NOT NULL REFERENCES public.balances(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Purchase Orders (PO Out)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id),
    type TEXT NOT NULL CHECK (type IN ('OUT', 'IN')),
    po_number TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'CREATED',
    vendor_id UUID REFERENCES public.vendors(id),
    vendor_pic_id UUID REFERENCES public.vendor_pics(id),
    vendor_letter_number TEXT,
    vendor_letter_date DATE,
    subject TEXT,
    notes TEXT,
    franco TEXT,
    delivery_time TEXT,
    payment_terms TEXT,
    dp_amount NUMERIC DEFAULT NULL,
    dp_percentage NUMERIC DEFAULT NULL,
    remaining_payment NUMERIC DEFAULT NULL,
    discount NUMERIC DEFAULT 0, -- Added from patch
    ppn NUMERIC DEFAULT 11, -- Added from patch
    transfer_proof_url TEXT, -- Added from migration
    transfer_proof_date TIMESTAMPTZ, -- Added from migration
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Order Quotations Junction (PO Out)
CREATE TABLE IF NOT EXISTS public.purchase_order_quotations (
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
    PRIMARY KEY (purchase_order_id, quotation_id)
);

-- Purchase Order Attachments (PO Out)
CREATE TABLE IF NOT EXISTS public.purchase_order_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Orders In (PO In / Invoices)
CREATE TABLE IF NOT EXISTS public.po_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id),
    quotation_id UUID REFERENCES public.quotations(id),
    subject TEXT,
    vendor_letter_number TEXT,
    vendor_letter_date DATE,
    invoice_number TEXT UNIQUE,
    invoice_date DATE,
    invoice_type TEXT DEFAULT 'FULL',
    sequence_number INTEGER,
    status TEXT DEFAULT 'pending',
    is_completed BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- PO In Attachments
CREATE TABLE IF NOT EXISTS public.po_in_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_in_id UUID REFERENCES public.po_ins(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Internal Letters (Surat Jalan/Tugas)
CREATE TABLE IF NOT EXISTS public.internal_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id),
    po_in_id UUID REFERENCES public.po_ins(id) ON DELETE CASCADE,
    internal_letter_number TEXT UNIQUE,
    sj_number TEXT,
    type TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    recipient_name TEXT,
    notes TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tracking Activities
CREATE TABLE IF NOT EXISTS public.tracking_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_letter_id UUID NOT NULL REFERENCES public.internal_letters(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    title TEXT,
    description TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Tracking Attachments
CREATE TABLE IF NOT EXISTS public.tracking_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_activity_id UUID NOT NULL REFERENCES public.tracking_activities(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ==========================================
-- 5. FUNCTION & TRIGGERS
-- ==========================================

-- Function to key updated_at current
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply Triggers
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'company', 'team_members', 'customers', 'customer_pics', 'vendors', 'vendor_pics',
        'default_difficulty_settings', 'default_delivery_time_settings', 'default_payment_time_settings', 'default_overall_cost_settings', 'customer_default_settings',
        'requests', 'balances', 'balance_settings', 'balance_vendor_settings', 'balance_items', 
        'shipping_vendor_mpa', 'shipping_mpa_customer', 'difficulty_settings',
        'quotations', 'purchase_orders', 'po_ins', 'internal_letters'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
            EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
        END IF;
    END LOOP;
END $$;

-- ==========================================
-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
-- ==========================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'company', 'company_product_documents', 'team_members', 'team_member_documents',
        'customers', 'customer_pics', 'vendors', 'vendor_pics',
        'default_difficulty_settings', 'default_delivery_time_settings', 'default_payment_time_settings', 'default_overall_cost_settings', 'customer_default_settings',
        'requests', 'request_attachments', 
        'balances', 'balance_settings', 'balance_vendor_settings', 'balance_items', 'shipping_vendor_mpa', 'shipping_mpa_customer', 'difficulty_settings',
        'quotations', 'quotation_balances',
        'purchase_orders', 'purchase_order_quotations', 'purchase_order_attachments',
        'po_ins', 'po_in_attachments',
        'internal_letters', 'tracking_activities', 'tracking_attachments'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'Enable all access for all users') THEN
                EXECUTE format('CREATE POLICY "Enable all access for all users" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
            END IF;
        END IF;
    END LOOP;
END $$;


-- ==========================================
-- 7. STORAGE BUCKETS & POLICIES
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES 
('request-attachments', 'request-attachments', true),
('company-files', 'company-files', true),
('purchase-order-attachments', 'purchase-order-attachments', true),
('tracking-attachments', 'tracking-attachments', true),
('vendor-bucket', 'vendor-bucket', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Public Access request-attachments" ON storage.objects FOR ALL USING (bucket_id = 'request-attachments');
CREATE POLICY "Public Access company-files" ON storage.objects FOR ALL USING (bucket_id = 'company-files');
CREATE POLICY "Public Access purchase-order-attachments" ON storage.objects FOR ALL USING (bucket_id = 'purchase-order-attachments');
CREATE POLICY "Public Access tracking-attachments" ON storage.objects FOR ALL USING (bucket_id = 'tracking-attachments');
CREATE POLICY "Public Access vendor-bucket" ON storage.objects FOR ALL USING (bucket_id = 'vendor-bucket');


-- ==========================================
-- 8. RPC: DASHBOARD STATISTICS
-- ==========================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(start_date TIMESTAMP WITH TIME ZONE, end_date TIMESTAMP WITH TIME ZONE)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH invoices_data AS (
        SELECT 
            pi.id,
            pi.invoice_date,
            pi.created_at,
            pi.status,
            pi.is_completed,
            pi.quotation_id,
            pi.invoice_number,
            (SELECT COALESCE(SUM(bi.total_selling_price), 0) FROM quotations q JOIN quotation_balances qb ON qb.quotation_id = q.id JOIN balances b ON b.id = qb.balance_id LEFT JOIN balance_items bi ON bi.balance_id = b.id WHERE q.id = pi.quotation_id) as amount,
            (SELECT COALESCE(c.company_name, 'Umum') FROM quotations q JOIN requests r ON r.id = q.request_id JOIN customers c ON c.id = r.customer_id WHERE q.id = pi.quotation_id) as customer_name,
            (SELECT COALESCE(r.title, q.quotation_number) FROM quotations q LEFT JOIN requests r ON r.id = q.request_id WHERE q.id = pi.quotation_id) as project_name
        FROM po_ins pi
        WHERE pi.invoice_number IS NOT NULL
    ),
    expenses_data AS (
        SELECT 
            po.id, po.created_at, po.status, po.type,
            CASE WHEN (COALESCE(po.dp_amount, 0) + COALESCE(po.remaining_payment, 0)) > 0 THEN (COALESCE(po.dp_amount, 0) + COALESCE(po.remaining_payment, 0))
                ELSE (SELECT COALESCE(SUM(bi.purchase_price * bi.qty), 0) FROM purchase_order_quotations poq JOIN quotations q ON q.id = poq.quotation_id JOIN quotation_balances qb ON qb.quotation_id = q.id JOIN balances b ON b.id = qb.balance_id JOIN balance_items bi ON bi.balance_id = b.id WHERE poq.purchase_order_id = po.id AND bi.vendor_id = po.vendor_id)
            END as amount,
            COALESCE(v.company_name, 'Vendor Umum') as vendor_name,
            (SELECT poq.quotation_id FROM purchase_order_quotations poq WHERE poq.purchase_order_id = po.id LIMIT 1) as linked_quotation_id
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        WHERE po.type = 'OUT'
    ),
    metrics_agg AS (
        SELECT
            COALESCE(SUM(CASE WHEN (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) AND COALESCE(invoice_date, created_at) >= start_date AND COALESCE(invoice_date, created_at) <= end_date THEN amount ELSE 0 END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) THEN amount ELSE 0 END), 0) as receivables,
            COUNT(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) THEN 1 END) as pending_inv_count,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) <= 30 THEN amount ELSE 0 END), 0) as aging_0_30,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) BETWEEN 31 AND 60 THEN amount ELSE 0 END), 0) as aging_31_60,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) > 60 THEN amount ELSE 0 END), 0) as aging_60_plus
        FROM invoices_data
    ),
    expenses_agg AS (
        SELECT
            COALESCE(SUM(CASE WHEN created_at >= start_date AND created_at <= end_date THEN amount ELSE 0 END), 0) as total_expenses,
            COALESCE(SUM(CASE WHEN status NOT IN ('completed', 'cancelled') THEN amount ELSE 0 END), 0) as payables
        FROM expenses_data
    ),
    monthly_trend AS (
        SELECT TO_CHAR(invoice_date, 'Mon YYYY') as name, SUM(amount) as revenue, 0 as expense, MIN(invoice_date) as sort_date
        FROM invoices_data WHERE (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) AND COALESCE(invoice_date, created_at) >= start_date AND COALESCE(invoice_date, created_at) <= end_date GROUP BY 1
        UNION ALL
        SELECT TO_CHAR(created_at, 'Mon YYYY') as name, 0 as revenue, SUM(amount) as expense, MIN(created_at) as sort_date
        FROM expenses_data WHERE created_at >= start_date AND created_at <= end_date GROUP BY 1
    ),
    top_customers AS (
        SELECT customer_name as name, SUM(amount) as value FROM invoices_data
        WHERE (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) AND invoice_date >= start_date AND invoice_date <= end_date GROUP BY 1 ORDER BY 2 DESC LIMIT 5
    ),
    vendor_spend AS (
        SELECT vendor_name as name, SUM(amount) as value FROM expenses_data WHERE created_at >= start_date AND created_at <= end_date GROUP BY 1 ORDER BY 2 DESC LIMIT 5
    ),
    project_margins AS (
        SELECT COALESCE(i.project_name, 'Proyek Tanpa Nama') as name, i.quotation_id, COALESCE(SUM(i.amount), 0) as revenue,
            (SELECT COALESCE(SUM(e.amount), 0) FROM expenses_data e WHERE e.linked_quotation_id = i.quotation_id AND e.created_at >= start_date AND e.created_at <= end_date) as expense
        FROM invoices_data i WHERE i.quotation_id IS NOT NULL And i.status IN ('completed', 'approved', 'pending') AND COALESCE(i.invoice_date, i.created_at) >= start_date AND COALESCE(i.invoice_date, i.created_at) <= end_date GROUP BY i.quotation_id, i.project_name
    ),
    staff_bottleneck_raw AS (
        SELECT r.created_by, 'request' as type, 1 as cnt FROM requests r WHERE r.created_at >= start_date AND r.created_at <= end_date
        UNION ALL SELECT b.created_by, 'balance' as type, 1 as cnt FROM balances b WHERE b.created_at >= start_date AND b.created_at <= end_date
        UNION ALL SELECT q.created_by, 'quotation' as type, 1 as cnt FROM quotations q WHERE q.created_at >= start_date AND q.created_at <= end_date
        UNION ALL SELECT p.created_by, 'purchase_order' as type, 1 as cnt FROM po_ins p WHERE p.created_at >= start_date AND p.created_at <= end_date
        UNION ALL SELECT il.created_by, 'internal_letter' as type, 1 as cnt FROM internal_letters il WHERE il.created_at >= start_date AND il.created_at <= end_date
        UNION ALL SELECT il.created_by, 'tracking' as type, 1 as cnt FROM tracking_activities ta JOIN internal_letters il ON il.id = ta.internal_letter_id WHERE ta.created_at >= start_date AND ta.created_at <= end_date
        UNION ALL SELECT p.created_by, 'invoice' as type, 1 as cnt FROM po_ins p WHERE p.invoice_number IS NOT NULL AND COALESCE(p.invoice_date, p.created_at) >= start_date AND COALESCE(p.invoice_date, p.created_at) <= end_date
    ),
    staff_bottleneck AS (
        SELECT COALESCE(tm.name, 'Unknown') as name,
            SUM(CASE WHEN type = 'request' THEN cnt ELSE 0 END) as request_baru,
            SUM(CASE WHEN type = 'balance' THEN cnt ELSE 0 END) as balance_baru,
            SUM(CASE WHEN type = 'quotation' THEN cnt ELSE 0 END) as quotation_baru,
            SUM(CASE WHEN type = 'purchase_order' THEN cnt ELSE 0 END) as menunggu_letter,
            SUM(CASE WHEN type = 'internal_letter' THEN cnt ELSE 0 END) as menunggu_tracking,
            SUM(CASE WHEN type = 'tracking' THEN cnt ELSE 0 END) as proses_tracking,
            SUM(CASE WHEN type = 'invoice' THEN cnt ELSE 0 END) as selesai_invoice
        FROM staff_bottleneck_raw sbr LEFT JOIN team_members tm ON tm.user_id = sbr.created_by GROUP BY tm.name
        UNION ALL
        SELECT 'Semua' as name, SUM(CASE WHEN type = 'request' THEN cnt ELSE 0 END), SUM(CASE WHEN type = 'balance' THEN cnt ELSE 0 END), SUM(CASE WHEN type = 'quotation' THEN cnt ELSE 0 END),
            SUM(CASE WHEN type = 'purchase_order' THEN cnt ELSE 0 END), SUM(CASE WHEN type = 'internal_letter' THEN cnt ELSE 0 END), SUM(CASE WHEN type = 'tracking' THEN cnt ELSE 0 END), SUM(CASE WHEN type = 'invoice' THEN cnt ELSE 0 END)
        FROM staff_bottleneck_raw sbr
    )

    SELECT JSON_BUILD_OBJECT(
        'metrics', JSON_BUILD_OBJECT(
            'totalRevenue', (SELECT total_revenue FROM metrics_agg),
            'totalExpenses', (SELECT total_expenses FROM expenses_agg),
            'netProfit', ((SELECT total_revenue FROM metrics_agg) - (SELECT total_expenses FROM expenses_agg)),
            'pendingInvoicesCount', (SELECT pending_inv_count FROM metrics_agg),
            'pendingInvoicesAmount', (SELECT receivables FROM metrics_agg),
            'accountsReceivable', (SELECT receivables FROM metrics_agg),
            'accountsPayable', (SELECT payables FROM expenses_agg),
            'taxIn', ((SELECT total_expenses FROM expenses_agg) * 0.11),
            'taxOut', ((SELECT total_revenue FROM metrics_agg) * 0.11)
        ),
        'charts', JSON_BUILD_OBJECT(
            'revenueTrend', (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', name, 'revenue', revenue, 'expense', expense) ORDER BY sort_date), '[]'::json) FROM (SELECT name, SUM(revenue) as revenue, SUM(expense) as expense, sort_date FROM monthly_trend GROUP BY name, sort_date) m),
            'topCustomers', (SELECT COALESCE(JSON_AGG(t), '[]'::json) FROM top_customers t),
            'vendorSpend', (SELECT COALESCE(JSON_AGG(v), '[]'::json) FROM vendor_spend v),
            'quotationPipeline', (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('status', INITCAP(status), 'count', cnt)), '[]'::json) FROM (SELECT status, COUNT(*) as cnt FROM quotations WHERE status IS NOT NULL AND created_at >= start_date AND created_at <= end_date GROUP BY 1) p),
            'staffWorkload', (SELECT COALESCE(JSON_AGG(sw), '[]'::json) FROM (SELECT tm.name, wc.cnt as "count" FROM (SELECT q.created_by, COUNT(*) as cnt FROM quotations q WHERE q.created_at >= start_date AND q.created_at <= end_date GROUP BY 1) wc JOIN team_members tm ON tm.user_id = wc.created_by ORDER BY wc.cnt DESC LIMIT 7) sw),
            'projectMargins', (SELECT COALESCE(JSON_AGG(pm), '[]'::json) FROM (SELECT pm.name, pm.revenue, (pm.revenue - pm.expense) as margin, CASE WHEN pm.revenue > 0 THEN ((pm.revenue - pm.expense) / pm.revenue * 100) ELSE 0 END as "marginPercent", r.request_code, COALESCE(r.title, '') as title, COALESCE(tm.name, 'Unknown') as creator_name FROM project_margins pm LEFT JOIN quotations q ON q.id = pm.quotation_id LEFT JOIN requests r ON r.id = q.request_id LEFT JOIN team_members tm ON tm.user_id = r.created_by ORDER BY margin DESC LIMIT 5) pm),
            'invoiceAging', JSON_BUILD_ARRAY(JSON_BUILD_OBJECT('range', '0-30 Hari', 'value', (SELECT aging_0_30 FROM metrics_agg)), JSON_BUILD_OBJECT('range', '31-60 Hari', 'value', (SELECT aging_31_60 FROM metrics_agg)), JSON_BUILD_OBJECT('range', '> 60 Hari', 'value', (SELECT aging_60_plus FROM metrics_agg))),
            'staffBottleneck', (SELECT COALESCE(JSON_AGG(sb), '[]'::json) FROM staff_bottleneck sb)
        ),
        'lists', JSON_BUILD_OBJECT(
            'recentActivities', (SELECT COALESCE(JSON_AGG(act), '[]'::json) FROM (SELECT ta.id, ta.status, ta.created_at, CASE WHEN il.sj_number IS NOT NULL THEN il.sj_number WHEN il.internal_letter_number IS NOT NULL THEN ('Letter # ' || il.internal_letter_number) WHEN r.request_code IS NOT NULL THEN r.request_code ELSE 'Logistik (No Subject)' END as subject, COALESCE(r.title, '') as title, COALESCE(c.company_name, '') as customer_name, COALESCE(tm.name, 'Unknown') as creator_name FROM tracking_activities ta LEFT JOIN internal_letters il ON il.id = ta.internal_letter_id LEFT JOIN po_ins pi ON pi.id = il.po_in_id LEFT JOIN quotations q ON q.id = pi.quotation_id LEFT JOIN requests r ON r.id = q.request_id LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN team_members tm ON tm.user_id = r.created_by WHERE ta.created_at >= start_date AND ta.created_at <= end_date ORDER BY ta.created_at DESC LIMIT 5) act),
            'upcomingDeadlines', (SELECT COALESCE(JSON_AGG(d), '[]'::json) FROM (SELECT r.id, r.title, r.submission_deadline, r.created_at, COALESCE(c.company_name, 'Client') as company_name, r.request_code, COALESCE(tm.name, 'Unknown') as creator_name FROM requests r LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN team_members tm ON tm.user_id = r.created_by WHERE r.submission_deadline IS NOT NULL ORDER BY r.submission_deadline ASC LIMIT 5) d),
            'invoiceDueDates', (SELECT COALESCE(JSON_AGG(idd), '[]'::json) FROM (SELECT pi.id, pi.invoice_number, COALESCE(c.company_name, 'Client') as company_name, pi.invoice_date, pi.is_completed, COALESCE(tm.name, 'Unknown') as creator_name, ((COALESCE(pi.approved_at, pi.invoice_date, pi.created_at)::DATE + (COALESCE((SELECT SUBSTRING(dpts.payment_category FROM '\d+')::INT FROM default_payment_time_settings dpts WHERE dpts.id = cds.payment_category_id), 0) || ' days')::INTERVAL)::DATE) as due_date, (SELECT dpts.payment_category FROM default_payment_time_settings dpts WHERE dpts.id = cds.payment_category_id) as term FROM po_ins pi LEFT JOIN quotations q ON q.id = pi.quotation_id LEFT JOIN requests r ON r.id = q.request_id LEFT JOIN customers c ON c.id = r.customer_id LEFT JOIN customer_default_settings cds ON cds.customer_id = c.id LEFT JOIN team_members tm ON tm.user_id = r.created_by WHERE pi.status IN ('approved', 'completed', 'pending') AND pi.invoice_number IS NOT NULL ORDER BY due_date ASC LIMIT 5) idd),
            'myTasks', (SELECT COALESCE(JSON_AGG(tsk), '[]'::json) FROM (SELECT q.id, ('Draft: ' || COALESCE(r.title, q.quotation_number)) as title, 'Quotation' as type, '/quotations' as link FROM quotations q LEFT JOIN requests r ON r.id = q.request_id WHERE q.created_by = auth.uid() AND q.status = 'draft' LIMIT 5) tsk)
        )
    );
$$;

-- ==========================================
-- 9. RECENT MIGRATIONS & UPDATES
-- ==========================================

-- Migration: Add offering letter details to balance_vendor_settings
ALTER TABLE balance_vendor_settings
ADD COLUMN IF NOT EXISTS vendor_letter_number text,
ADD COLUMN IF NOT EXISTS vendor_letter_date text; -- Storing date as text/string to match existing patterns

COMMENT ON COLUMN balance_vendor_settings.vendor_letter_number IS 'Stores the Offering Letter Number for this vendor in this balance (synced across items)';
COMMENT ON COLUMN balance_vendor_settings.vendor_letter_date IS 'Stores the Offering Letter Date for this vendor in this balance (synced across items)';


-- Migration: Add is_closed column to quotations table
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;


-- Migration: Restore last_follow_up_at column
ALTER TABLE public.quotations
ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP WITH TIME ZONE;


-- Update: Dashboard Statistics RPC (Latest Version)
CREATE OR REPLACE FUNCTION get_dashboard_stats(start_date TIMESTAMP WITH TIME ZONE, end_date TIMESTAMP WITH TIME ZONE)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH invoices_data AS (
        SELECT 
            pi.id,
            pi.invoice_date,
            pi.created_at,
            pi.status,
            pi.is_completed,
            pi.quotation_id,
            pi.invoice_number,
            (
                SELECT COALESCE(SUM(bi.total_selling_price), 0)
                FROM quotations q
                JOIN quotation_balances qb ON qb.quotation_id = q.id
                JOIN balances b ON b.id = qb.balance_id
                LEFT JOIN balance_items bi ON bi.balance_id = b.id
                WHERE q.id = pi.quotation_id
            ) as amount,
            (
                SELECT COALESCE(c.company_name, 'Umum') 
                FROM quotations q
                JOIN requests r ON r.id = q.request_id
                JOIN customers c ON c.id = r.customer_id
                WHERE q.id = pi.quotation_id
            ) as customer_name,
            (
                 SELECT COALESCE(r.title, q.quotation_number)
                 FROM quotations q
                 LEFT JOIN requests r ON r.id = q.request_id
                 WHERE q.id = pi.quotation_id
            ) as project_name
        FROM po_ins pi
        WHERE pi.invoice_number IS NOT NULL
    ),
    expenses_data AS (
        SELECT 
            po.id,
            po.created_at,
            po.status,
            po.type,
            CASE 
                WHEN (COALESCE(po.dp_amount, 0) + COALESCE(po.remaining_payment, 0)) > 0 
                THEN (COALESCE(po.dp_amount, 0) + COALESCE(po.remaining_payment, 0))
                ELSE (
                    SELECT COALESCE(SUM(bi.purchase_price * bi.qty), 0) 
                    FROM purchase_order_quotations poq
                    JOIN quotations q ON q.id = poq.quotation_id
                    JOIN quotation_balances qb ON qb.quotation_id = q.id
                    JOIN balances b ON b.id = qb.balance_id
                    JOIN balance_items bi ON bi.balance_id = b.id
                    WHERE poq.purchase_order_id = po.id AND bi.vendor_id = po.vendor_id
                )
            END as amount,
            COALESCE(v.company_name, 'Vendor Umum') as vendor_name,
            (
                SELECT poq.quotation_id 
                FROM purchase_order_quotations poq 
                WHERE poq.purchase_order_id = po.id 
                LIMIT 1
            ) as linked_quotation_id
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        WHERE po.type = 'OUT'
    ),
    metrics_agg AS (
        SELECT
            COALESCE(SUM(CASE 
                WHEN (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) 
                     AND COALESCE(invoice_date, created_at) >= start_date 
                     AND COALESCE(invoice_date, created_at) <= end_date 
                THEN amount ELSE 0 END), 0) as total_revenue,
            
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) THEN amount ELSE 0 END), 0) as receivables,
            
            COUNT(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) THEN 1 END) as pending_inv_count,
            
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) <= 30 THEN amount ELSE 0 END), 0) as aging_0_30,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) BETWEEN 31 AND 60 THEN amount ELSE 0 END), 0) as aging_31_60,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) > 60 THEN amount ELSE 0 END), 0) as aging_60_plus
        FROM invoices_data
    ),
    expenses_agg AS (
        SELECT
            COALESCE(SUM(CASE WHEN created_at >= start_date AND created_at <= end_date THEN amount ELSE 0 END), 0) as total_expenses,
            COALESCE(SUM(CASE WHEN status NOT IN ('completed', 'cancelled') THEN amount ELSE 0 END), 0) as payables
        FROM expenses_data
    ),
    monthly_trend AS (
        SELECT 
            TO_CHAR(invoice_date, 'Mon YYYY') as name,
            SUM(amount) as revenue,
            0 as expense,
            MIN(invoice_date) as sort_date
        FROM invoices_data
        WHERE (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) 
          AND COALESCE(invoice_date, created_at) >= start_date AND COALESCE(invoice_date, created_at) <= end_date
        GROUP BY 1
        UNION ALL
        SELECT
            TO_CHAR(created_at, 'Mon YYYY') as name,
            0 as revenue,
            SUM(amount) as expense,
            MIN(created_at) as sort_date
        FROM expenses_data
        WHERE created_at >= start_date AND created_at <= end_date
        GROUP BY 1
    ),
    top_customers AS (
        SELECT customer_name as name, SUM(amount) as value
        FROM invoices_data
        WHERE (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) AND invoice_date >= start_date AND invoice_date <= end_date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ),
    vendor_spend AS (
        SELECT vendor_name as name, SUM(amount) as value
        FROM expenses_data
        WHERE created_at >= start_date AND created_at <= end_date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ),
    project_margins AS (
        SELECT 
            COALESCE(i.project_name, 'Proyek Tanpa Nama') as name,
            i.quotation_id,
            COALESCE(SUM(i.amount), 0) as revenue,
            (
                SELECT COALESCE(SUM(e.amount), 0)
                FROM expenses_data e
                WHERE e.linked_quotation_id = i.quotation_id
                  AND e.created_at >= start_date AND e.created_at <= end_date
            ) as expense
        FROM invoices_data i
        WHERE i.quotation_id IS NOT NULL 
          And i.status IN ('completed', 'approved', 'pending')
          AND COALESCE(i.invoice_date, i.created_at) >= start_date AND COALESCE(i.invoice_date, i.created_at) <= end_date
        GROUP BY i.quotation_id, i.project_name
    ),
    staff_bottleneck_raw AS (
        SELECT r.created_by, 'request' as type, 1 as cnt
        FROM requests r
        WHERE r.created_at >= start_date AND r.created_at <= end_date
        UNION ALL
        SELECT b.created_by, 'balance' as type, 1 as cnt
        FROM balances b
        WHERE b.created_at >= start_date AND b.created_at <= end_date
        UNION ALL
        SELECT q.created_by, 'quotation' as type, 1 as cnt
        FROM quotations q
        WHERE q.created_at >= start_date AND q.created_at <= end_date
        UNION ALL
        SELECT p.created_by, 'purchase_order' as type, 1 as cnt
        FROM po_ins p
        WHERE p.created_at >= start_date AND p.created_at <= end_date
        UNION ALL
        SELECT il.created_by, 'internal_letter' as type, 1 as cnt
        FROM internal_letters il
        WHERE il.created_at >= start_date AND il.created_at <= end_date
        UNION ALL
        SELECT il.created_by, 'tracking' as type, 1 as cnt
        FROM tracking_activities ta
        JOIN internal_letters il ON il.id = ta.internal_letter_id
        WHERE ta.created_at >= start_date AND ta.created_at <= end_date
        UNION ALL
        SELECT p.created_by, 'invoice' as type, 1 as cnt
        FROM po_ins p
        WHERE p.invoice_number IS NOT NULL
          AND COALESCE(p.invoice_date, p.created_at) >= start_date 
          AND COALESCE(p.invoice_date, p.created_at) <= end_date
    ),
    staff_bottleneck AS (
        SELECT
            COALESCE(tm.name, 'Unknown') as name,
            SUM(CASE WHEN type = 'request' THEN cnt ELSE 0 END) as request_baru,
            SUM(CASE WHEN type = 'balance' THEN cnt ELSE 0 END) as balance_baru,
            SUM(CASE WHEN type = 'quotation' THEN cnt ELSE 0 END) as quotation_baru,
            SUM(CASE WHEN type = 'purchase_order' THEN cnt ELSE 0 END) as menunggu_letter,
            SUM(CASE WHEN type = 'internal_letter' THEN cnt ELSE 0 END) as menunggu_tracking,
            SUM(CASE WHEN type = 'tracking' THEN cnt ELSE 0 END) as proses_tracking,
            SUM(CASE WHEN type = 'invoice' THEN cnt ELSE 0 END) as selesai_invoice
        FROM staff_bottleneck_raw sbr
        LEFT JOIN team_members tm ON tm.user_id = sbr.created_by
        GROUP BY tm.name
        UNION ALL
        SELECT
            'Semua' as name,
            SUM(CASE WHEN type = 'request' THEN cnt ELSE 0 END) as request_baru,
            SUM(CASE WHEN type = 'balance' THEN cnt ELSE 0 END) as balance_baru,
            SUM(CASE WHEN type = 'quotation' THEN cnt ELSE 0 END) as quotation_baru,
            SUM(CASE WHEN type = 'purchase_order' THEN cnt ELSE 0 END) as menunggu_letter,
            SUM(CASE WHEN type = 'internal_letter' THEN cnt ELSE 0 END) as menunggu_tracking,
            SUM(CASE WHEN type = 'tracking' THEN cnt ELSE 0 END) as proses_tracking,
            SUM(CASE WHEN type = 'invoice' THEN cnt ELSE 0 END) as selesai_invoice
        FROM staff_bottleneck_raw sbr
    )

    SELECT JSON_BUILD_OBJECT(
        'metrics', JSON_BUILD_OBJECT(
            'totalRevenue', (SELECT total_revenue FROM metrics_agg),
            'totalExpenses', (SELECT total_expenses FROM expenses_agg),
            'netProfit', ((SELECT total_revenue FROM metrics_agg) - (SELECT total_expenses FROM expenses_agg)),
            'pendingInvoicesCount', (SELECT pending_inv_count FROM metrics_agg),
            'pendingInvoicesAmount', (SELECT receivables FROM metrics_agg),
            'accountsReceivable', (SELECT receivables FROM metrics_agg),
            'accountsPayable', (SELECT payables FROM expenses_agg),
            'taxIn', ((SELECT total_expenses FROM expenses_agg) * 0.11),
            'taxOut', ((SELECT total_revenue FROM metrics_agg) * 0.11)
        ),
        'charts', JSON_BUILD_OBJECT(
            'revenueTrend', (
                SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', name, 'revenue', revenue, 'expense', expense) ORDER BY sort_date), '[]'::json)
                FROM (
                    SELECT name, SUM(revenue) as revenue, SUM(expense) as expense, sort_date
                    FROM monthly_trend
                    GROUP BY name, sort_date
                ) m
            ),
            'topCustomers', (
                SELECT COALESCE(JSON_AGG(t), '[]'::json) FROM top_customers t
            ),
            'vendorSpend', (
                SELECT COALESCE(JSON_AGG(v), '[]'::json) FROM vendor_spend v
            ),
            'quotationPipeline', (
                SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('status', INITCAP(status), 'count', cnt)), '[]'::json)
                FROM (
                    SELECT status, COUNT(*) as cnt 
                    FROM quotations 
                    WHERE status IS NOT NULL 
                      AND created_at >= start_date AND created_at <= end_date
                    GROUP BY 1
                ) p
            ),
            'staffWorkload', (
                 SELECT COALESCE(JSON_AGG(sw), '[]'::json)
                 FROM (
                    SELECT tm.name, wc.cnt as "count"
                    FROM (
                       SELECT q.created_by, COUNT(*) as cnt
                       FROM quotations q
                       WHERE q.created_at >= start_date AND q.created_at <= end_date
                       GROUP BY 1
                    ) wc
                    JOIN team_members tm ON tm.user_id = wc.created_by
                    ORDER BY wc.cnt DESC LIMIT 7
                 ) sw
            ),
            'projectMargins', (
                SELECT COALESCE(JSON_AGG(pm), '[]'::json)
                FROM (
                    SELECT 
                        pm.name, 
                        pm.revenue, 
                        (pm.revenue - pm.expense) as margin, 
                        CASE WHEN pm.revenue > 0 THEN ((pm.revenue - pm.expense) / pm.revenue * 100) ELSE 0 END as "marginPercent",
                        r.request_code,
                        COALESCE(r.title, '') as title,
                        COALESCE(tm.name, 'Unknown') as creator_name
                    FROM project_margins pm
                    LEFT JOIN quotations q ON q.id = pm.quotation_id
                    LEFT JOIN requests r ON r.id = q.request_id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    ORDER BY margin DESC
                    LIMIT 5
                ) pm
            ),
            'invoiceAging', JSON_BUILD_ARRAY(
                JSON_BUILD_OBJECT('range', '0-30 Hari', 'value', (SELECT aging_0_30 FROM metrics_agg)),
                JSON_BUILD_OBJECT('range', '31-60 Hari', 'value', (SELECT aging_31_60 FROM metrics_agg)),
                JSON_BUILD_OBJECT('range', '> 60 Hari', 'value', (SELECT aging_60_plus FROM metrics_agg))
            ),
            'staffBottleneck', (
                SELECT COALESCE(JSON_AGG(sb), '[]'::json)
                FROM staff_bottleneck sb
            )
        ),
        'lists', JSON_BUILD_OBJECT(
            'recentActivities', (
                SELECT COALESCE(JSON_AGG(act), '[]'::json)
                FROM (
                    SELECT 
                        ta.id, ta.status, ta.created_at,
                        CASE 
                            WHEN il.sj_number IS NOT NULL THEN il.sj_number
                            WHEN il.internal_letter_number IS NOT NULL THEN ('Letter # ' || il.internal_letter_number)
                            WHEN r.request_code IS NOT NULL THEN r.request_code
                            ELSE 'Logistik (No Subject)' 
                        END as subject,
                        COALESCE(r.title, '') as title,
                        COALESCE(c.company_name, '') as customer_name,
                        COALESCE(tm.name, 'Unknown') as creator_name
                    FROM tracking_activities ta
                    LEFT JOIN internal_letters il ON il.id = ta.internal_letter_id
                    LEFT JOIN po_ins pi ON pi.id = il.po_in_id
                    LEFT JOIN quotations q ON q.id = pi.quotation_id
                    LEFT JOIN requests r ON r.id = q.request_id
                    LEFT JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    WHERE ta.created_at >= start_date AND ta.created_at <= end_date
                    ORDER BY ta.created_at DESC
                    LIMIT 5
                ) act
            ),
            'upcomingDeadlines', (
                 SELECT COALESCE(JSON_AGG(d), '[]'::json)
                 FROM (
                    SELECT 
                        r.id, 
                        r.title, 
                        r.submission_deadline, 
                        r.created_at,
                        COALESCE(c.company_name, 'Client') as company_name,
                        r.request_code, 
                        COALESCE(tm.name, 'Unknown') as creator_name
                    FROM requests r
                    LEFT JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    WHERE r.submission_deadline IS NOT NULL
                    ORDER BY r.submission_deadline ASC
                    LIMIT 5
                ) d
            ),
            'invoiceDueDates', (
                SELECT COALESCE(JSON_AGG(idd), '[]'::json)
                FROM (
                    SELECT 
                        pi.id,
                        pi.invoice_number,
                        COALESCE(c.company_name, 'Client') as company_name,
                        pi.invoice_date,
                        pi.is_completed,
                        COALESCE(tm.name, 'Unknown') as creator_name,
                        ((COALESCE(pi.approved_at, pi.invoice_date, pi.created_at)::DATE + (COALESCE(
                            (SELECT SUBSTRING(dpts.payment_category FROM '\d+')::INT 
                             FROM default_payment_time_settings dpts 
                             WHERE dpts.id = cds.payment_category_id), 
                            0
                        ) || ' days')::INTERVAL)::DATE) as due_date,
                        (SELECT dpts.payment_category 
                         FROM default_payment_time_settings dpts 
                         WHERE dpts.id = cds.payment_category_id) as term
                    FROM po_ins pi
                    LEFT JOIN quotations q ON q.id = pi.quotation_id
                    LEFT JOIN requests r ON r.id = q.request_id
                    LEFT JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN customer_default_settings cds ON cds.customer_id = c.id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    WHERE pi.status IN ('approved', 'completed', 'pending')
                      AND pi.invoice_number IS NOT NULL
                    ORDER BY due_date ASC
                    LIMIT 5
                ) idd
            ),
            'myTasks', (
                 SELECT COALESCE(JSON_AGG(tsk), '[]'::json)
                 FROM (
                     SELECT q.id, 
                            ('Draft: ' || COALESCE(r.title, q.quotation_number)) as title, 
                            'Quotation' as type, 
                            '/quotations' as link
                     FROM quotations q
                     LEFT JOIN requests r ON r.id = q.request_id
                     WHERE q.created_by = auth.uid() AND q.status = 'draft'
                     LIMIT 5
                ) tsk
            )
        )
    );
$$;
