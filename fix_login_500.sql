-- FIX LOGIN 500 ERROR & LINK USERS
-- Masalah: User "bodat@gmail.com" (dan lainnya) dibuat di 'team_members' tanpa 'user_id', tapi sudah dibuat di 'auth.users'.
-- Saat login, sistem (trigger) mungkin mencoba membuat entry baru di team_members dan gagal karena email duplikat, menyebabkan error 500.

BEGIN;

-- 1. Link Orpahn Team Members to Auth Users
-- Mencocokkan email di team_members (yang user_id-nya NULL/Mismatch) dengan auth.users
UPDATE public.team_members tm
SET user_id = au.id
FROM auth.users au
WHERE tm.email = au.email
  AND (tm.user_id IS NULL OR tm.user_id != au.id);

-- 2. Pastikan UUID di team_members.id SAMA dengan auth.users.id jika memungkinkan (Optional, tapi Auth UID biasanya source of truth)
-- Jika team_members punya ID sendiri yang acak, update 'user_id' kolomnya (yang relasi FK) adalah solusi benar.
-- Asumsi: team_members punya kolom 'user_id' sebagai FK.

-- Jika ternyata team_members memaki kolom 'id' sebagai FK ke auth.users (1:1 strict):
-- Maka kita tidak bisa sekedar update, karena ID adalah Primary Key.
-- Kita harus Insert row baru dengan ID benar, lalu hapus row lama.

-- Cek apakah 'user_id' column ada? Jika tidak, kita pakai approach 'Strict ID Match'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'user_id') THEN
        -- Column exist, sync logical (sudah dilakukan di query UPDATE diatas)
        NULL;
    ELSE
        -- Column 'user_id' TIDAK ADA. Artinya 'id' table ini HARUS sama dengan 'auth.users.id'.
        -- Kita perlu melakukan migrasi ID untuk user yang salah.
        
        -- Temporary table mapping failed ids
        CREATE TEMP TABLE fix_map AS
        SELECT tm.id as old_id, au.id as new_id
        FROM public.team_members tm
        JOIN auth.users au ON tm.email = au.email
        WHERE tm.id != au.id;

        -- Update FK references first (if cascading/deferred, might be auto, but safest to be explicit if possible)
        -- Complex logic... simplified: delete old, update ID? OR insert new.
        
        -- Insert new rows with correct ID
        INSERT INTO public.team_members (id, name, email, birthplace, birthdate, address, position, role, created_at, updated_at)
        SELECT 
            au.id, 
            tm.name, 
            tm.email, 
            tm.birthplace, 
            tm.birthdate, 
            tm.address, 
            tm.position, 
            tm.role,
            tm.created_at,
            tm.updated_at
        FROM public.team_members tm
        JOIN auth.users au ON tm.email = au.email
        WHERE tm.id != au.id
        ON CONFLICT (id) DO NOTHING;
        
        -- Move documents to new ID
        UPDATE public.team_member_documents tmd
        SET team_member_id = fm.new_id
        FROM fix_map fm
        WHERE tmd.team_member_id = fm.old_id;

        -- Delete old rows
        DELETE FROM public.team_members
        WHERE id IN (SELECT old_id FROM fix_map);
        
        DROP TABLE fix_map;
    END IF;
END $$;

COMMIT;
