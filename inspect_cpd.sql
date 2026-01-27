
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'company_product_documents'
ORDER BY column_name;

SELECT * FROM company_product_documents LIMIT 5;
