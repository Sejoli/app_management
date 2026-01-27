-- FORCE OPEN ACCESS TO TEAM_MEMBERS
-- Masalah: Frontend menampilkan UUID tapi bukan Nama. Ini berarti data ada, tapi Frontend tidak bisa men-join ke tabel team_members karena permission/RLS.

BEGIN;

-- 1. Pastikan RLS Aktif (agar policy jalan)
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 2. Hapus SEMUA Policy lama pada team_members (untuk membersihkan restrictive rules)
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.team_members;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.team_members;
DROP POLICY IF EXISTS "Pimpinan view all" ON public.team_members;
-- (Tambahkan nama policy lain jika diketahui, tapi DROP IF EXISTS aman)

-- 3. Buat SATU Policy Super Longgar untuk SELECT (Read Only)
-- "Semua user yang login (authenticated) BOLEH melihat data semua staff (team_members)"
CREATE POLICY "Allow All Authenticated View All TeamMembers"
ON public.team_members
FOR SELECT
TO authenticated
USING (true);

-- 4. Pastikan User 'authenticated' punya hak SELECT di level database
GRANT SELECT ON public.team_members TO authenticated;

-- 5. Cek apakah user dengan UUID tersebut ada?
-- Ganti UUID ini dengan yang muncul di error (b3e64d1c...)
SELECT * FROM public.team_members WHERE user_id = 'b3e64d1c-a31a-43f3-b239-7f9ad62cea61';

COMMIT;
