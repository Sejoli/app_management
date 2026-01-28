-- MIGRATION: ADD SNAPSHOT COLUMNS FOR DATA INTEGRITY (REVISED)
-- Tujuan: Menyimpan salinan data master (Customer/Vendor) saat transaksi dibuat.
-- Agar jika Master Data berubah, history transaksi tidak ikut berubah.

BEGIN;

-- 1. Requests (Snapshot Data Customer & PIC)
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS customer_snapshot JSONB DEFAULT NULL;

-- 2. Quotations (Snapshot Data Customer & PIC saat Quotation dibuat)
ALTER TABLE public.quotations 
ADD COLUMN IF NOT EXISTS customer_snapshot JSONB DEFAULT NULL;

-- 3. Purchase Orders (Snapshot Data Vendor saat PO Out dibuat)
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS vendor_snapshot JSONB DEFAULT NULL;

-- 4. PO IN / Invoices (Snapshot Data Vendor & Customer saat Invoice dicatat)
ALTER TABLE public.po_ins 
ADD COLUMN IF NOT EXISTS snapshot_data JSONB DEFAULT NULL;

-- 5. Internal Letters (Snapshot Penerima/Lokasi)
ALTER TABLE public.internal_letters 
ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB DEFAULT NULL;

-- 6. Balances (Snapshot Cost/Harga Global saat Neraca dibuat)
ALTER TABLE public.balances 
ADD COLUMN IF NOT EXISTS cost_snapshot JSONB DEFAULT NULL;

-- 7. Balance Items (Snapshot Vendor per Item Barang/Jasa)
-- PENTING: Karena setiap baris neraca bisa punya vendor berbeda.
ALTER TABLE public.balance_items 
ADD COLUMN IF NOT EXISTS vendor_snapshot JSONB DEFAULT NULL;

-- 8. Tracking Activities (Snapshot Lokasi/Status jika ambil dari master data lain)
ALTER TABLE public.tracking_activities 
ADD COLUMN IF NOT EXISTS snapshot_data JSONB DEFAULT NULL;

COMMIT;
