-- Add percentage column to default_payment_time_settings
ALTER TABLE public.default_payment_time_settings
ADD COLUMN percentage numeric NOT NULL DEFAULT 0;

-- Remove return_cost from customer_default_settings
ALTER TABLE public.customer_default_settings
DROP COLUMN return_cost;