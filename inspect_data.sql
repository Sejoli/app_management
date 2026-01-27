-- Inspect Balance Items and Pricing
SELECT 
    pi.invoice_number,
    q.quotation_number,
    b.id as balance_id,
    COUNT(bi.id) as item_count,
    SUM(bi.total_selling_price) as total_price,
    SUM(bi.purchase_price) as total_cost
FROM po_ins pi
LEFT JOIN quotations q ON q.id = pi.quotation_id
LEFT JOIN quotation_balances qb ON qb.quotation_id = q.id
LEFT JOIN balances b ON b.id = qb.balance_id
LEFT JOIN balance_items bi ON bi.balance_id = b.id
GROUP BY pi.invoice_number, q.quotation_number, b.id;
