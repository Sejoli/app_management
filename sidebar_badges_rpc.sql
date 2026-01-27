CREATE OR REPLACE FUNCTION get_sidebar_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    count_requests INT;
    count_balances INT;
    count_quotations INT;
    count_pos INT;
    count_letters INT;
    count_tracking INT;
    count_invoices INT;
    
    curr_user_id UUID;
    user_role TEXT;
    is_viewer_all BOOLEAN;
BEGIN
    -- Get current user context
    curr_user_id := auth.uid();
    
    -- Get User Role from team_members
    SELECT role INTO user_role 
    FROM team_members 
    WHERE user_id = curr_user_id;
    
    -- Determine if user should see ALL data (Pimpinan, Super Admin, Owner, etc)
    -- Adjust these roles based on your specific 'pimpinan' role name. Assuming 'pimpinan', 'super_admin', 'owner'.
    is_viewer_all := user_role IN ('pimpinan', 'super_admin', 'owner', 'director', 'manager'); 
    
    -- If user_role is null (e.g. anon), treat as restricted or handle gracefully.
    -- Assuming authenticated users have a role.
    IF is_viewer_all IS NULL THEN
        is_viewer_all := false;
    END IF;

    -- 1. Requests: Not linked to Quotation AND Not linked to Balance
    SELECT COUNT(*) INTO count_requests
    FROM requests r
    WHERE (is_viewer_all OR r.created_by = curr_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM quotations q WHERE q.request_id = r.id
    )
    AND NOT EXISTS (
        SELECT 1 FROM balances b WHERE b.request_id = r.id
    );

    -- 2. Balances: Unlinked Entries
    -- For balances, we check if the BALANCE RECORD itself is visible (created_by user OR admin)
    WITH visible_balances AS (
        SELECT * FROM balances b
        WHERE (is_viewer_all OR b.created_by = curr_user_id)
    ),
    all_entries AS (
        SELECT 
            vb.id as balance_id,
            (jsonb_array_elements(vb.balance_entries)->>'id')::int as entry_id
        FROM visible_balances vb
    )
    SELECT COUNT(*) INTO count_balances
    FROM all_entries ae
    WHERE NOT EXISTS (
        SELECT 1 
        FROM quotation_balances qb 
        WHERE qb.balance_id = ae.balance_id 
          AND qb.entry_id = ae.entry_id
    );

    -- 3. Quotations: Not linked to PO (and not cancelled/rejected)
    SELECT COUNT(*) INTO count_quotations
    FROM quotations q
    WHERE (is_viewer_all OR q.created_by = curr_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM po_ins p WHERE p.quotation_id = q.id
    )
    AND q.status NOT IN ('cancelled', 'rejected');

    -- 4. POs: Not linked to Internal Letter
    SELECT COUNT(*) INTO count_pos
    FROM po_ins p
    WHERE (is_viewer_all OR p.created_by = curr_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM internal_letters il WHERE il.po_in_id = p.id
    );

    -- 5. Internal Letters: Not linked to Tracking
    SELECT COUNT(*) INTO count_letters
    FROM internal_letters il
    WHERE (is_viewer_all OR il.created_by = curr_user_id)
      AND NOT EXISTS (
        SELECT 1 FROM tracking_activities ta WHERE ta.internal_letter_id = il.id
    );

    -- 6. Tracking: Active tracking but no Invoice
    -- Based on Internal Letter ownership
    SELECT COUNT(DISTINCT il.id) INTO count_tracking
    FROM internal_letters il
    WHERE (is_viewer_all OR il.created_by = curr_user_id)
      AND EXISTS (
        SELECT 1 FROM tracking_activities ta WHERE ta.internal_letter_id = il.id
    )
    AND NOT EXISTS (
         -- Check if linked PO has an invoice
         SELECT 1 
         FROM po_ins p 
         WHERE p.id = il.po_in_id 
           AND p.invoice_number IS NOT NULL
    );

    -- 7. Invoices: Not Paid (Not Approved/Paid)
    -- Based on PO ownership
    SELECT COUNT(*) INTO count_invoices
    FROM po_ins p
    WHERE (is_viewer_all OR p.created_by = curr_user_id)
      AND p.invoice_number IS NOT NULL 
      AND p.status NOT IN ('approved', 'cancelled');

    RETURN json_build_object(
        'view_requests', count_requests,
        'view_balances', count_balances,
        'view_quotations', count_quotations,
        'view_purchase_orders', count_pos,
        'view_internal_letters', count_letters,
        'view_tracking', count_tracking,
        'view_invoices', count_invoices
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_sidebar_counts() TO postgres, anon, authenticated, service_role;
