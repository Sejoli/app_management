CREATE OR REPLACE FUNCTION get_dashboard_stats(start_date TIMESTAMP WITH TIME ZONE, end_date TIMESTAMP WITH TIME ZONE)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH invoices_data AS (
        SELECT 
            pi.id,
            pi.invoice_date,
            pi.created_at,
            pi.status,
            pi.is_completed,
            pi.quotation_id,
            pi.invoice_number,
            (
                SELECT COALESCE(SUM(bi.total_selling_price), 0)
                FROM quotations q
                JOIN quotation_balances qb ON qb.quotation_id = q.id
                JOIN balances b ON b.id = qb.balance_id
                LEFT JOIN balance_items bi ON bi.balance_id = b.id
                WHERE q.id = pi.quotation_id
            ) as amount,
            (
                SELECT COALESCE(c.company_name, 'Umum') 
                FROM quotations q
                JOIN requests r ON r.id = q.request_id
                JOIN customers c ON c.id = r.customer_id
                WHERE q.id = pi.quotation_id
            ) as customer_name,
            (
                 SELECT COALESCE(r.title, q.quotation_number)
                 FROM quotations q
                 LEFT JOIN requests r ON r.id = q.request_id
                 WHERE q.id = pi.quotation_id
            ) as project_name
        FROM po_ins pi
        WHERE pi.invoice_number IS NOT NULL
    ),
    expenses_data AS (
        SELECT 
            po.id,
            po.created_at,
            po.status,
            po.type,
            CASE 
                WHEN (COALESCE(po.dp_amount, 0) + COALESCE(po.remaining_payment, 0)) > 0 
                THEN (COALESCE(po.dp_amount, 0) + COALESCE(po.remaining_payment, 0))
                ELSE (
                    SELECT COALESCE(SUM(bi.purchase_price * bi.qty), 0) 
                    FROM purchase_order_quotations poq
                    JOIN quotations q ON q.id = poq.quotation_id
                    JOIN quotation_balances qb ON qb.quotation_id = q.id
                    JOIN balances b ON b.id = qb.balance_id
                    JOIN balance_items bi ON bi.balance_id = b.id
                    WHERE poq.purchase_order_id = po.id AND bi.vendor_id = po.vendor_id
                )
            END as amount,
            COALESCE(v.company_name, 'Vendor Umum') as vendor_name,
            (
                SELECT poq.quotation_id 
                FROM purchase_order_quotations poq 
                WHERE poq.purchase_order_id = po.id 
                LIMIT 1
            ) as linked_quotation_id
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        WHERE po.type = 'OUT'
    ),
    metrics_agg AS (
        SELECT
            -- MODIFIED: Include pending/approved as 'Billed Revenue' to show values on dashboard
            COALESCE(SUM(CASE 
                WHEN (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) 
                     AND COALESCE(invoice_date, created_at) >= start_date 
                     AND COALESCE(invoice_date, created_at) <= end_date 
                THEN amount ELSE 0 END), 0) as total_revenue,
            
            -- Receivables (Outstanding)
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) THEN amount ELSE 0 END), 0) as receivables,
            
            COUNT(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) THEN 1 END) as pending_inv_count,
            
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) <= 30 THEN amount ELSE 0 END), 0) as aging_0_30,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) BETWEEN 31 AND 60 THEN amount ELSE 0 END), 0) as aging_31_60,
            COALESCE(SUM(CASE WHEN status NOT IN ('cancelled', 'completed') AND (is_completed IS FALSE OR is_completed IS NULL) AND EXTRACT(DAY FROM NOW() - invoice_date) > 60 THEN amount ELSE 0 END), 0) as aging_60_plus
        FROM invoices_data
    ),
    expenses_agg AS (
        SELECT
            COALESCE(SUM(CASE WHEN created_at >= start_date AND created_at <= end_date THEN amount ELSE 0 END), 0) as total_expenses,
            COALESCE(SUM(CASE WHEN status NOT IN ('completed', 'cancelled') THEN amount ELSE 0 END), 0) as payables
        FROM expenses_data
    ),
    monthly_trend AS (
        SELECT 
            TO_CHAR(invoice_date, 'Mon YYYY') as name,
            SUM(amount) as revenue,
            0 as expense,
            MIN(invoice_date) as sort_date
        FROM invoices_data
        -- MODIFIED: Include pending/approved
        WHERE (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) 
          AND COALESCE(invoice_date, created_at) >= start_date AND COALESCE(invoice_date, created_at) <= end_date
        GROUP BY 1
        UNION ALL
        SELECT
            TO_CHAR(created_at, 'Mon YYYY') as name,
            0 as revenue,
            SUM(amount) as expense,
            MIN(created_at) as sort_date
        FROM expenses_data
        WHERE created_at >= start_date AND created_at <= end_date
        GROUP BY 1
    ),
    top_customers AS (
        SELECT customer_name as name, SUM(amount) as value
        FROM invoices_data
        WHERE (status IN ('completed', 'approved', 'pending') OR is_completed IS TRUE) AND invoice_date >= start_date AND invoice_date <= end_date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ),
    vendor_spend AS (
        SELECT vendor_name as name, SUM(amount) as value
        FROM expenses_data
        WHERE created_at >= start_date AND created_at <= end_date
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ),
    project_margins AS (
        SELECT 
            COALESCE(i.project_name, 'Proyek Tanpa Nama') as name,
            i.quotation_id,
            COALESCE(SUM(i.amount), 0) as revenue,
            (
                SELECT COALESCE(SUM(e.amount), 0)
                FROM expenses_data e
                WHERE e.linked_quotation_id = i.quotation_id
                  AND e.created_at >= start_date AND e.created_at <= end_date
            ) as expense
        FROM invoices_data i
        WHERE i.quotation_id IS NOT NULL 
          And i.status IN ('completed', 'approved', 'pending')
          AND COALESCE(i.invoice_date, i.created_at) >= start_date AND COALESCE(i.invoice_date, i.created_at) <= end_date
        GROUP BY i.quotation_id, i.project_name
    ),
    staff_bottleneck_raw AS (
        SELECT r.created_by, 'request' as type, 1 as cnt
        FROM requests r
        WHERE r.created_at >= start_date AND r.created_at <= end_date
        UNION ALL
        SELECT b.created_by, 'balance' as type, 1 as cnt
        FROM balances b
        WHERE b.created_at >= start_date AND b.created_at <= end_date
        UNION ALL
        SELECT q.created_by, 'quotation' as type, 1 as cnt
        FROM quotations q
        WHERE q.created_at >= start_date AND q.created_at <= end_date
        UNION ALL
        SELECT p.created_by, 'purchase_order' as type, 1 as cnt
        FROM po_ins p
        WHERE p.created_at >= start_date AND p.created_at <= end_date
        UNION ALL
        SELECT il.created_by, 'internal_letter' as type, 1 as cnt
        FROM internal_letters il
        WHERE il.created_at >= start_date AND il.created_at <= end_date
        UNION ALL
        SELECT il.created_by, 'tracking' as type, 1 as cnt
        FROM tracking_activities ta
        JOIN internal_letters il ON il.id = ta.internal_letter_id
        WHERE ta.created_at >= start_date AND ta.created_at <= end_date
        UNION ALL
        SELECT p.created_by, 'invoice' as type, 1 as cnt
        FROM po_ins p
        WHERE p.invoice_number IS NOT NULL
          AND COALESCE(p.invoice_date, p.created_at) >= start_date 
          AND COALESCE(p.invoice_date, p.created_at) <= end_date
    ),
    staff_bottleneck AS (
        SELECT
            COALESCE(tm.name, 'Unknown') as name,
            SUM(CASE WHEN type = 'request' THEN cnt ELSE 0 END) as request_baru,
            SUM(CASE WHEN type = 'balance' THEN cnt ELSE 0 END) as balance_baru,
            SUM(CASE WHEN type = 'quotation' THEN cnt ELSE 0 END) as quotation_baru,
            SUM(CASE WHEN type = 'purchase_order' THEN cnt ELSE 0 END) as menunggu_letter,
            SUM(CASE WHEN type = 'internal_letter' THEN cnt ELSE 0 END) as menunggu_tracking,
            SUM(CASE WHEN type = 'tracking' THEN cnt ELSE 0 END) as proses_tracking,
            SUM(CASE WHEN type = 'invoice' THEN cnt ELSE 0 END) as selesai_invoice
        FROM staff_bottleneck_raw sbr
        LEFT JOIN team_members tm ON tm.user_id = sbr.created_by
        GROUP BY tm.name
        UNION ALL
        SELECT
            'Semua' as name,
            SUM(CASE WHEN type = 'request' THEN cnt ELSE 0 END) as request_baru,
            SUM(CASE WHEN type = 'balance' THEN cnt ELSE 0 END) as balance_baru,
            SUM(CASE WHEN type = 'quotation' THEN cnt ELSE 0 END) as quotation_baru,
            SUM(CASE WHEN type = 'purchase_order' THEN cnt ELSE 0 END) as menunggu_letter,
            SUM(CASE WHEN type = 'internal_letter' THEN cnt ELSE 0 END) as menunggu_tracking,
            SUM(CASE WHEN type = 'tracking' THEN cnt ELSE 0 END) as proses_tracking,
            SUM(CASE WHEN type = 'invoice' THEN cnt ELSE 0 END) as selesai_invoice
        FROM staff_bottleneck_raw sbr
    )

    SELECT JSON_BUILD_OBJECT(
        'metrics', JSON_BUILD_OBJECT(
            'totalRevenue', (SELECT total_revenue FROM metrics_agg),
            'totalExpenses', (SELECT total_expenses FROM expenses_agg),
            'netProfit', ((SELECT total_revenue FROM metrics_agg) - (SELECT total_expenses FROM expenses_agg)),
            'pendingInvoicesCount', (SELECT pending_inv_count FROM metrics_agg),
            'pendingInvoicesAmount', (SELECT receivables FROM metrics_agg),
            'accountsReceivable', (SELECT receivables FROM metrics_agg),
            'accountsPayable', (SELECT payables FROM expenses_agg),
            'taxIn', ((SELECT total_expenses FROM expenses_agg) * 0.11),
            'taxOut', ((SELECT total_revenue FROM metrics_agg) * 0.11)
        ),
        'charts', JSON_BUILD_OBJECT(
            'revenueTrend', (
                SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', name, 'revenue', revenue, 'expense', expense) ORDER BY sort_date), '[]'::json)
                FROM (
                    SELECT name, SUM(revenue) as revenue, SUM(expense) as expense, sort_date
                    FROM monthly_trend
                    GROUP BY name, sort_date
                ) m
            ),
            'topCustomers', (
                SELECT COALESCE(JSON_AGG(t), '[]'::json) FROM top_customers t
            ),
            'vendorSpend', (
                SELECT COALESCE(JSON_AGG(v), '[]'::json) FROM vendor_spend v
            ),
            'quotationPipeline', (
                SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('status', INITCAP(status), 'count', cnt)), '[]'::json)
                FROM (
                    SELECT status, COUNT(*) as cnt 
                    FROM quotations 
                    WHERE status IS NOT NULL 
                      AND created_at >= start_date AND created_at <= end_date
                    GROUP BY 1
                ) p
            ),
            'staffWorkload', (
                 SELECT COALESCE(JSON_AGG(sw), '[]'::json)
                 FROM (
                    SELECT tm.name, wc.cnt as "count"
                    FROM (
                       SELECT q.created_by, COUNT(*) as cnt
                       FROM quotations q
                       WHERE q.created_at >= start_date AND q.created_at <= end_date
                       GROUP BY 1
                    ) wc
                    JOIN team_members tm ON tm.user_id = wc.created_by
                    ORDER BY wc.cnt DESC LIMIT 7
                 ) sw
            ),
            'projectMargins', (
                SELECT COALESCE(JSON_AGG(pm), '[]'::json)
                FROM (
                    SELECT 
                        pm.name, 
                        pm.revenue, 
                        (pm.revenue - pm.expense) as margin, 
                        CASE WHEN pm.revenue > 0 THEN ((pm.revenue - pm.expense) / pm.revenue * 100) ELSE 0 END as "marginPercent",
                        r.request_code,
                        COALESCE(r.title, '') as title,
                        COALESCE(tm.name, 'Unknown') as creator_name
                    FROM project_margins pm
                    LEFT JOIN quotations q ON q.id = pm.quotation_id
                    LEFT JOIN requests r ON r.id = q.request_id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    ORDER BY margin DESC
                    LIMIT 5
                ) pm
            ),
            'invoiceAging', JSON_BUILD_ARRAY(
                JSON_BUILD_OBJECT('range', '0-30 Hari', 'value', (SELECT aging_0_30 FROM metrics_agg)),
                JSON_BUILD_OBJECT('range', '31-60 Hari', 'value', (SELECT aging_31_60 FROM metrics_agg)),
                JSON_BUILD_OBJECT('range', '> 60 Hari', 'value', (SELECT aging_60_plus FROM metrics_agg))
            ),
            'staffBottleneck', (
                SELECT COALESCE(JSON_AGG(sb), '[]'::json)
                FROM staff_bottleneck sb
            )
        ),
        'lists', JSON_BUILD_OBJECT(
            'recentActivities', (
                SELECT COALESCE(JSON_AGG(act), '[]'::json)
                FROM (
                    SELECT 
                        ta.id, ta.status, ta.created_at,
                        CASE 
                            WHEN il.sj_number IS NOT NULL THEN il.sj_number
                            WHEN il.internal_letter_number IS NOT NULL THEN ('Letter # ' || il.internal_letter_number)
                            WHEN r.request_code IS NOT NULL THEN r.request_code
                            ELSE 'Logistik (No Subject)' 
                        END as subject,
                        COALESCE(r.title, '') as title,
                        COALESCE(c.company_name, '') as customer_name,
                        COALESCE(tm.name, 'Unknown') as creator_name
                    FROM tracking_activities ta
                    LEFT JOIN internal_letters il ON il.id = ta.internal_letter_id
                    LEFT JOIN po_ins pi ON pi.id = il.po_in_id
                    LEFT JOIN quotations q ON q.id = pi.quotation_id
                    LEFT JOIN requests r ON r.id = q.request_id
                    LEFT JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    WHERE ta.created_at >= start_date AND ta.created_at <= end_date
                    ORDER BY ta.created_at DESC
                    LIMIT 5
                ) act
            ),
            'upcomingDeadlines', (
                 SELECT COALESCE(JSON_AGG(d), '[]'::json)
                 FROM (
                    SELECT 
                        r.id, 
                        r.title, 
                        r.submission_deadline, 
                        r.created_at,
                        COALESCE(c.company_name, 'Client') as company_name,
                        r.request_code, 
                        COALESCE(tm.name, 'Unknown') as creator_name
                    FROM requests r
                    LEFT JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    -- MODIFIED: Removed strict date filter to show ANY deadlines, ordered by date
                    WHERE r.submission_deadline IS NOT NULL
                    ORDER BY r.submission_deadline ASC
                    LIMIT 5
                ) d
            ),
            'invoiceDueDates', (
                SELECT COALESCE(JSON_AGG(idd), '[]'::json)
                FROM (
                    SELECT 
                        pi.id,
                        pi.invoice_number,
                        COALESCE(c.company_name, 'Client') as company_name,
                        pi.invoice_date,
                        pi.is_completed,
                        COALESCE(tm.name, 'Unknown') as creator_name,
                        ((COALESCE(pi.approved_at, pi.invoice_date, pi.created_at)::DATE + (COALESCE(
                            (SELECT SUBSTRING(dpts.payment_category FROM '\d+')::INT 
                             FROM default_payment_time_settings dpts 
                             WHERE dpts.id = cds.payment_category_id), 
                            0
                        ) || ' days')::INTERVAL)::DATE) as due_date,
                        (SELECT dpts.payment_category 
                         FROM default_payment_time_settings dpts 
                         WHERE dpts.id = cds.payment_category_id) as term
                    FROM po_ins pi
                    LEFT JOIN quotations q ON q.id = pi.quotation_id
                    LEFT JOIN requests r ON r.id = q.request_id
                    LEFT JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN customer_default_settings cds ON cds.customer_id = c.id
                    LEFT JOIN team_members tm ON tm.user_id = r.created_by
                    WHERE pi.status IN ('approved', 'completed', 'pending')
                      AND pi.invoice_number IS NOT NULL
                    ORDER BY due_date ASC
                    LIMIT 5
                ) idd
            ),
            'myTasks', (
                 SELECT COALESCE(JSON_AGG(tsk), '[]'::json)
                 FROM (
                     SELECT q.id, 
                            ('Draft: ' || COALESCE(r.title, q.quotation_number)) as title, 
                            'Quotation' as type, 
                            '/quotations' as link
                     FROM quotations q
                     LEFT JOIN requests r ON r.id = q.request_id
                     WHERE q.created_by = auth.uid() AND q.status = 'draft'
                     LIMIT 5
                ) tsk
            )
        )
    );
$$;
