-- COMPREHENSIVE FIX: Creator Tracking & Pimpinan Visibility
-- Jalankan script ini di Supabase SQL Editor untuk memperbaiki masalah kolom "Dibuat Oleh" kosong
-- dan memastikan Pimpinan bisa melihat semua data.

BEGIN;

-- ==============================================================================
-- 1. MEMASTIKAN KOLOM & CONSTRAINT (SCHEMA ENFORCEMENT)
-- ==============================================================================

-- 1.1 Pastikan Public read access ke team_members (agar frontend bisa ambil nama)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.team_members;
CREATE POLICY "Allow read access for authenticated users" ON public.team_members FOR SELECT TO authenticated USING (true);

-- 1.2 Pastikan kolom created_by ada dan constraint Foreign Key ke team_members terpasang
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['purchase_orders', 'po_ins', 'quotations', 'requests', 'balances', 'internal_letters'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- A. Tambah kolom jika belum ada
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'created_by') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()', t);
        END IF;

        -- B. Tambah constraint FK ke team_members(user_id) untuk memudahkan join di frontend
        --    Constraint ini bernama 'fk_created_by_team_member' yang dipakai di query frontend:
        --    .select('..., creator:team_members!fk_created_by_team_member(name)')
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = t AND constraint_name = 'fk_created_by_team_member') THEN
            -- Hapus constraint lama jika ada konflik nama tapi beda definisi (opsional, tapi aman)
            -- EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS fk_created_by_team_member', t); 
            
            -- Buat constraint baru
            -- Pastikan team_members.user_id adalah UNIQUE (biasanya sudah via migration_tracking_setup.sql)
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_created_by_team_member FOREIGN KEY (created_by) REFERENCES public.team_members(user_id)', t);
        END IF;
    END LOOP;
END $$;


-- ==============================================================================
-- 2. BACKFILL DATA KOSONG (DATA REPAIR)
-- ==============================================================================
-- Mengisi kolom created_by yang NULL dengan user aktif saat ini (Admin/Anda)
-- atau Pimpinan jika dijalankan tanpa auth context (jarang terjadi di Editor tapi jaga-jaga).

DO $$
DECLARE
    current_uid UUID;
    target_uid UUID;
    t text;
    tables text[] := ARRAY['purchase_orders', 'po_ins', 'quotations', 'requests', 'balances', 'internal_letters'];
BEGIN
    current_uid := auth.uid();
    
    -- Jika auth.uid() null (misal run via psql direct), ambil user pertama yang pimpinan/admin
    IF current_uid IS NULL THEN
        SELECT user_id INTO target_uid FROM public.team_members WHERE role IN ('pimpinan', 'super_admin') LIMIT 1;
    ELSE
        target_uid := current_uid;
    END IF;

    IF target_uid IS NOT NULL THEN
        FOREACH t IN ARRAY tables LOOP
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
                EXECUTE format('UPDATE public.%I SET created_by = %L WHERE created_by IS NULL', t, target_uid);
            END IF;
        END LOOP;
    END IF;
END $$;


-- ==============================================================================
-- 3. PERBAIKAN AKSES PIMPINAN (RLS POLICIES)
-- ==============================================================================
-- Memastikan Pimpinan bisa melihat ("View All") semua data, tidak hanya miliknya sendiri.

-- 3.1 Fungsi helper untuk cek akses 'View All'
CREATE OR REPLACE FUNCTION public.can_view_all_data()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
    AND (
        role IN ('pimpinan', 'super_admin') 
        OR position ILIKE '%direktur%' 
        OR position ILIKE '%director%'
    )
  );
$$;

-- 3.2 Terapkan Policy "Users view relevant data" ke semua tabel transaksi
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['purchase_orders', 'po_ins', 'quotations', 'requests', 'balances', 'internal_letters'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Drop policy lama yang mungkin membatasi (misal "Users view own data")
            EXECUTE format('DROP POLICY IF EXISTS "Users view own data" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "View own data" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users view relevant data" ON public.%I', t);
            
            -- Buat Policy baru: Creator boleh lihat ATAU Pimpinan boleh lihat semua
            EXECUTE format('CREATE POLICY "Users view relevant data" ON public.%I FOR SELECT USING (
                auth.uid() = created_by 
                OR 
                public.can_view_all_data()
            )', t);
            
        END IF;
    END LOOP;
END $$;

COMMIT;
