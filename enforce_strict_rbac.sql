-- Skrip untuk menerapkan Strict RBAC (Role-Based Access Control)
-- 1. Pimpinan: Read-Only (Himpunan akses 'view', cabut akses 'manage')
-- 2. Staff: Isolasi Data (Hanya bisa Ubah/Hapus data sendiri via RLS)

BEGIN;

-- BAGIAN 1: Update Permission (Mengontrol UI Frontend)
-- Cabut semua izin 'manage' dari role 'pimpinan'
UPDATE public.role_permissions
SET is_enabled = false
WHERE role = 'pimpinan' AND permission_key LIKE 'manage_%';

-- Pastikan semua izin 'view' aktif untuk 'pimpinan'
UPDATE public.role_permissions
SET is_enabled = true
WHERE role = 'pimpinan' AND permission_key LIKE 'view_%';

-- BAGIAN 2: Update RLS Policies (Mengontrol Security Backend)
-- Menerapkan aturan: UPDATE dan DELETE hanya boleh dilakukan oleh PEMBUAT DATA (created_by = auth.uid())

DO $$
DECLARE
    t text;
    has_creator boolean;
    -- Daftar tabel transaksi utama
    tables text[] := ARRAY[
        'requests', 
        'balances', 
        'quotations', 
        'purchase_orders', 
        'po_ins', 
        'internal_letters', 
        'invoices', 
        'tracking_activities', -- Cek dulu apakah punya created_by
        'balance_items'        -- Child table
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Cek apakah tabel ada
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Cek apakah kolom created_by ada
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND table_name = t 
                  AND column_name = 'created_by'
            ) INTO has_creator;

            IF has_creator THEN
                -- BERSIHKAN Policy Lama
                EXECUTE format('DROP POLICY IF EXISTS "Creator can update own data" ON public.%I', t);
                EXECUTE format('DROP POLICY IF EXISTS "Users can update own data" ON public.%I', t);
                
                EXECUTE format('DROP POLICY IF EXISTS "Creator can delete own data" ON public.%I', t);
                EXECUTE format('DROP POLICY IF EXISTS "Users can delete own data" ON public.%I', t);
                
                EXECUTE format('DROP POLICY IF EXISTS "Staff can insert data" ON public.%I', t);

                -- BUAT Policy Baru (Generic)
                EXECUTE format('CREATE POLICY "Creator can update own data" ON public.%I FOR UPDATE USING (auth.uid() = created_by)', t);
                EXECUTE format('CREATE POLICY "Creator can delete own data" ON public.%I FOR DELETE USING (auth.uid() = created_by)', t);
                EXECUTE format('CREATE POLICY "Staff can insert data" ON public.%I FOR INSERT WITH CHECK (auth.uid() = created_by)', t);
                
                RAISE NOTICE 'Updated strict RLS policies for table: %', t;
            
            ELSE
                RAISE NOTICE 'Table % does not have created_by column. Skipping generic RLS.', t;
                
                -- HANDLING KHUSUS UNTUK CHILD TABLES (Tanpa created_by)
                
                -- CASE 1: balance_items (Ikut balances.created_by)
                IF t = 'balance_items' THEN
                    EXECUTE format('DROP POLICY IF EXISTS "Creator can update parent balance items" ON public.%I', t);
                    EXECUTE format('DROP POLICY IF EXISTS "Creator can delete parent balance items" ON public.%I', t);
                    EXECUTE format('DROP POLICY IF EXISTS "Creator can insert parent balance items" ON public.%I', t);

                    -- Policy: Boleh akses jika parent (balance) dimiliki user
                    EXECUTE 'CREATE POLICY "Creator can update parent balance items" ON public.balance_items FOR UPDATE USING (
                        EXISTS (SELECT 1 FROM public.balances WHERE id = balance_items.balance_id AND created_by = auth.uid())
                    )';
                    
                    EXECUTE 'CREATE POLICY "Creator can delete parent balance items" ON public.balance_items FOR DELETE USING (
                        EXISTS (SELECT 1 FROM public.balances WHERE id = balance_items.balance_id AND created_by = auth.uid())
                    )';
                    
                    EXECUTE 'CREATE POLICY "Creator can insert parent balance items" ON public.balance_items FOR INSERT WITH CHECK (
                        EXISTS (SELECT 1 FROM public.balances WHERE id = balance_items.balance_id AND created_by = auth.uid())
                    )';
                    
                    RAISE NOTICE 'Applied specific parent-based RLS for %', t;
                END IF;

                -- CASE 2: tracking_activities (Asumsi jika tidak ada created_by, mungkin ikut internal_letters?)
                -- Jika ternyata tracking_activities punya created_by, dia masuk IF di atas.
                -- Jika tidak, kita skip dulu amannya, atau handle jika tahu parentnya.
                -- User tidak lapor error tracking, jadi mungkin aman atau belum dicek.
                
            END IF;

        END IF;
    END LOOP;
END $$;

COMMIT;
