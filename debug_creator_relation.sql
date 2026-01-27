-- Skrip Diagnostik untuk Memeriksa Data Creator

-- 1. Cek User ID Anda saat ini (dijalankan di SQL Editor Supabase akan pakai user context, tapi kita select manual saja dulu)
-- Kita cek apakah ada data di po_ins dan purchase_orders yang created_by nya NULL
SELECT 'PO Out (purchase_orders)' as table_name, count(*) as total, count(created_by) as filled_creator, count(*) - count(created_by) as null_creator
FROM purchase_orders
UNION ALL
SELECT 'PO In (po_ins)', count(*), count(created_by), count(*) - count(created_by)
FROM po_ins;

-- 2. Cek Sampel Data yang created_by nya terisi, apakah user_id nya ada di team_members?
SELECT 
    'PO Out Sample' as source,
    po.po_number,
    po.created_by,
    tm.name as creator_name_found
FROM purchase_orders po
LEFT JOIN team_members tm ON po.created_by = tm.user_id
WHERE po.created_by IS NOT NULL
LIMIT 5;

SELECT 
    'PO In Sample' as source,
    pi.subject,
    pi.created_by,
    tm.name as creator_name_found
FROM po_ins pi
LEFT JOIN team_members tm ON pi.created_by = tm.user_id
WHERE pi.created_by IS NOT NULL
LIMIT 5;

-- 3. Cek apakah constraint FK benar-benar ada
SELECT 
    tc.table_schema, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('purchase_orders', 'po_ins') AND kcu.column_name = 'created_by';
