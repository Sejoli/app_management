-- FINAL FIX: Creator Relation & Data
-- Tujuan: 
-- 1. Membersihkan relasi foreign key yang mungkin ganda.
-- 2. Memastikan tabel team_members bisa dibaca (RLS).
-- 3. Mengisi data created_by yang kosong.

BEGIN;

-- 1. Clean up Constraint (Hapus dulu agar bersih)
-- Kita coba hapus constraint dengan nama yang kita ketahui
DO $$ 
BEGIN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS fk_created_by_team_member;
    ALTER TABLE public.po_ins DROP CONSTRAINT IF EXISTS fk_created_by_team_member;
EXCEPTION WHEN OTHERS THEN 
    NULL; 
END $$;

-- 2. Re-Add Constraint (Pastikan hanya ada satu)
ALTER TABLE public.purchase_orders 
    ADD CONSTRAINT fk_created_by_team_member 
    FOREIGN KEY (created_by) REFERENCES public.team_members(user_id);

ALTER TABLE public.po_ins 
    ADD CONSTRAINT fk_created_by_team_member 
    FOREIGN KEY (created_by) REFERENCES public.team_members(user_id);

-- 3. Update RLS (Pastikan Team Member bisa dibaca semua user login)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.team_members;
CREATE POLICY "Enable read access for all authenticated users"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);

-- 4. Backfill Data (Isi created_by yang NULL dengan user yang menjalankan script ini)
-- Jika user menjalankan lewat Dashboard, auth.uid() mungkin ada. Jika manual, kita ambil salah satu user dari team_members jika auth.uid() null.

DO $$
DECLARE
    target_user uuid;
BEGIN
    target_user := auth.uid();
    
    -- Jika auth.uid() null (misal jalan di SQL editor tanpa konteks), ambil user pertama dari team_members sebagai default
    IF target_user IS NULL THEN
        SELECT user_id INTO target_user FROM public.team_members LIMIT 1;
    END IF;

    IF target_user IS NOT NULL THEN
        -- Update PO Out
        UPDATE public.purchase_orders 
        SET created_by = target_user 
        WHERE created_by IS NULL;

        -- Update PO In
        UPDATE public.po_ins 
        SET created_by = target_user 
        WHERE created_by IS NULL;
    END IF;
END $$;

COMMIT;

-- 5. Verifikasi Hasil (Tampilkan 5 data per tabel)
SELECT 'PO Out Check' as check_type, po.po_number, tm.name as creator_name
FROM purchase_orders po
LEFT JOIN team_members tm ON po.created_by = tm.user_id
LIMIT 5;

SELECT 'PO In Check' as check_type, pi.subject, tm.name as creator_name
FROM po_ins pi
LEFT JOIN team_members tm ON pi.created_by = tm.user_id
LIMIT 5;
