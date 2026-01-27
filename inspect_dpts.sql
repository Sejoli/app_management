
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'default_payment_time_settings'
ORDER BY column_name;

SELECT * FROM default_payment_time_settings LIMIT 5;
