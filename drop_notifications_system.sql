-- Drop notifications table
DROP TABLE IF EXISTS public.notifications;

-- Remove last_follow_up_at from quotations
ALTER TABLE public.quotations 
DROP COLUMN IF EXISTS last_follow_up_at;

-- NOTE: team_members.user_id is NOT dropped because it has foreign key dependencies 
-- from multiple tables (requests, balances, invoices, etc.) and is essential for creator mapping.
-- It seems to be a core structural column now.
