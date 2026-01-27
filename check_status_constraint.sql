SELECT
    pg_attribute.attname AS column_name,
    pg_type.typname AS data_type,
    pg_constraint.conname AS constraint_name,
    pg_get_constraintdef(pg_constraint.oid) AS constraint_definition
FROM
    pg_attribute
JOIN
    pg_type ON pg_attribute.atttypid = pg_type.oid
LEFT JOIN
    pg_constraint ON pg_constraint.conrelid = pg_attribute.attrelid AND pg_attribute.attnum = ANY(pg_constraint.conkey)
WHERE
    pg_attribute.attrelid = 'po_ins'::regclass
    AND pg_attribute.attname = 'status';
