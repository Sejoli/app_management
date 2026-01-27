-- FIX: Sync Team Members & Names
-- Masalah: Data 'created_by' (UUID) sudah ada, tapi Namanya tidak muncul.
-- Penyebab: UUID tersebut belum terdaftar di tabel 'team_members', sehingga relasi gamar tidak bisa meload nama.
-- Solusi: Script ini akan membuatkan profil di 'team_members' untuk setiap User yang belum punya.

BEGIN;

-- 1. Sync User ke Team Members
-- Ambil semua user dari auth.users, jika belum ada di team_members, buatkan entry baru.
INSERT INTO public.team_members (user_id, name, email, role, position, birthplace, birthdate, address)
SELECT 
    au.id, 
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 
    au.email, 
    'staff', 
    'Staff',
    '-', -- Default birthplace
    CURRENT_DATE, -- Default birthdate
    '-' -- Default address
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.user_id = au.id
);

-- 2. Khusus untuk UUID yang muncul di screenshot (b3e64d1c...) jika masih belum punya nama yang benar
-- Update nama jika entrynya baru dibuat dan namanya masih email prefix
UPDATE public.team_members
SET name = 'Admin / User (Fixed)'
WHERE user_id = 'b3e64d1c-a31a-43f3-b239-7f9ad62cea61' 
  AND name LIKE '%@%'; -- Hanya replace jika namanya terlihat seperti email (fallback)

-- 3. Verifikasi Constraint (Jaga-jaga)
-- Memastikan constraint FK benar-benar ada agar query frontend PostgREST bisa melakukan Join.
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['purchase_orders', 'po_ins', 'quotations', 'requests', 'balances', 'internal_letters'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
         IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = t AND constraint_name = 'fk_created_by_team_member') THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_created_by_team_member FOREIGN KEY (created_by) REFERENCES public.team_members(user_id)', t);
        END IF;
    END LOOP;
END $$;

COMMIT;
