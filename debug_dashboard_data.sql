-- Check PO Ins (Invoices)
SELECT COUNT(*) as total_po_ins, 
       COUNT(*) FILTER (WHERE invoice_number IS NOT NULL) as with_invoice_number,
       COUNT(*) FILTER (WHERE status IN ('approved', 'completed')) as approved_or_completed,
       status
FROM po_ins
GROUP BY status;

-- Check Requests (Deadlines)
SELECT COUNT(*) as total_requests,
       COUNT(*) FILTER (WHERE submission_deadline >= NOW()) as future_deadline
FROM requests;

-- Check Quotations (Project Margins)
SELECT COUNT(*) as total_quotations,
       status
FROM quotations
GROUP BY status;

-- Check Invoices with Date
SELECT id, invoice_number, invoice_date, created_at, status
FROM po_ins
WHERE invoice_number IS NOT NULL
LIMIT 5;
