-- Inspect Invoice Statuses for Debugging
SELECT 
    pi.invoice_number,
    pi.status,
    pi.is_completed,
    pi.invoice_date,
    pi.created_at,
    q.quotation_number AS linked_quotation,
    r.request_code AS linked_request
FROM po_ins pi
LEFT JOIN quotations q ON q.id = pi.quotation_id
LEFT JOIN requests r ON r.id = q.request_id
ORDER BY pi.created_at DESC;
