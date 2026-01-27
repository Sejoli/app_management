-- Skrip Cek Primary Key team_members
SELECT 
    tc.table_schema, 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE 
    tc.table_name = 'team_members' 
    AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE');
