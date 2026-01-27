
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_default_settings' OR table_name = 'default_payment_time_settings'
ORDER BY table_name, column_name;
