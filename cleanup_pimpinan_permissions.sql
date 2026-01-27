-- Skrip untuk menghapus semua izin role 'pimpinan' dari database.
-- Jalankan ini jika Anda ingin membersihkan data permissions yang tadi dimasukkan.

BEGIN;

DELETE FROM role_permissions 
WHERE role = 'pimpinan';

COMMIT;

-- Verifikasi bahwa data sudah kosong untuk pimpinan
SELECT * FROM role_permissions WHERE role = 'pimpinan';
