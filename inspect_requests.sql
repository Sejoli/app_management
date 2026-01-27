
SELECT id, request_code, title, customer_id, submission_deadline, created_at 
FROM requests 
ORDER BY created_at DESC 
LIMIT 5;
