-- Mengembalikan akses 'manage' untuk role pimpinan
-- Agar mereka BISA mengelola data (tapi RLS tetap membatasi hanya data sendiri)

UPDATE public.role_permissions
SET is_enabled = true
WHERE role = 'pimpinan' AND permission_key LIKE 'manage_%';

-- Pastikan view permissions juga true (seharusnya sudah)
UPDATE public.role_permissions
SET is_enabled = true
WHERE role = 'pimpinan' AND permission_key LIKE 'view_%';
