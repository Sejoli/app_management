-- Enable Realtime for Balance and Quotation tables
-- Uses DO block to safely add tables without erroring if they are already added

DO $$
BEGIN
    -- 1. Enable Realtime for balance_items
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE balance_items;
    EXCEPTION 
        WHEN duplicate_object THEN NULL; 
        WHEN OTHERS THEN 
            -- Ignore "already member" errors (state 42710)
            NULL;
    END;

    -- 2. Enable Realtime for quotation_balances
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE quotation_balances;
    EXCEPTION 
        WHEN duplicate_object THEN NULL; 
        WHEN OTHERS THEN 
            NULL;
    END;
END $$;
