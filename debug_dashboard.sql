-- Debug Query to check if the RPC logic works directly
-- Run this in SQL Editor to verify data existence

WITH temp_invoices AS (
    SELECT 
        pi.id,
        pi.invoice_date,
        pi.status,
        pi.quotation_id,
        pi.invoice_number,
        (
            SELECT COALESCE(SUM(bi.total_selling_price), 0)
            FROM quotations q
            JOIN quotation_balances qb ON qb.quotation_id = q.id
            JOIN balances b ON b.id = qb.balance_id
            JOIN balance_items bi ON bi.balance_id = b.id
            WHERE q.id = pi.quotation_id
        ) as amount
    FROM po_ins pi
    WHERE pi.invoice_number IS NOT NULL
)
SELECT 
    COUNT(*) as total_invoices,
    SUM(amount) as total_amount,
    SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_revenue
FROM temp_invoices;
