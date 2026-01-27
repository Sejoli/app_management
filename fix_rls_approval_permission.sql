-- FIX RLS APPROVAL PERMISSIONS
-- Masalah: Kebijakan Strict RBAC memblokir Pimpinan meng-approve surat/PO buatan Staff.
-- Solusi: Izinkan UPDATE jika user adalah creator ATAU memiliki role 'pimpinan'/'super_admin'.

BEGIN;

DO $$
DECLARE
    t text;
    has_creator boolean;
    -- Daftar tabel transaksi yang butuh approval/edit oleh pimpinan
    tables text[] := ARRAY[
        'requests', 
        'balances', 
        'quotations', 
        'purchase_orders', 
        'po_ins', 
        'internal_letters', 
        'invoices'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Pastikan kolom created_by ada
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                  AND table_name = t 
                  AND column_name = 'created_by'
            ) INTO has_creator;

            IF has_creator THEN
                -- 1. DROP Policy Lama (Strict Creator Only)
                EXECUTE format('DROP POLICY IF EXISTS "Creator can update own data" ON public.%I', t);
                EXECUTE format('DROP POLICY IF EXISTS "Creator or Pimpinan can update data" ON public.%I', t); -- Jaga-jaga jika duplicate name

                -- 2. CREATE Policy Baru (Creator + Pimpinan/SuperAdmin)
                -- Logic: Boleh update jika (Saya Creator) ATAU (Saya Pimpinan/SuperAdmin)
                EXECUTE format('CREATE POLICY "Creator or Pimpinan can update data" ON public.%I FOR UPDATE USING (
                    (auth.uid() = created_by) 
                    OR 
                    (EXISTS (
                        SELECT 1 FROM public.team_members 
                        WHERE user_id = auth.uid() 
                        AND role IN (''pimpinan'', ''super_admin'')
                    ))
                )', t);
                
                RAISE NOTICE 'Fixed RLS UPDATE policy for table: %', t;

                -- 3. DELETE Policy (Opsional: Apakah Pimpinan boleh hapus data staff? Biasanya ya untuk SuperAdmin)
                EXECUTE format('DROP POLICY IF EXISTS "Creator can delete own data" ON public.%I', t);
                EXECUTE format('DROP POLICY IF EXISTS "Creator or Pimpinan can delete data" ON public.%I', t);

                EXECUTE format('CREATE POLICY "Creator or Pimpinan can delete data" ON public.%I FOR DELETE USING (
                    (auth.uid() = created_by) 
                    OR 
                    (EXISTS (
                        SELECT 1 FROM public.team_members 
                        WHERE user_id = auth.uid() 
                        AND role IN (''pimpinan'', ''super_admin'')
                    ))
                )', t);
                
                RAISE NOTICE 'Fixed RLS DELETE policy for table: %', t;

            END IF;
        END IF;
    END LOOP;
END $$;

COMMIT;
