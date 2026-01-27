-- Create table for Balance Vendor Settings
CREATE TABLE IF NOT EXISTS public.balance_vendor_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    balance_id UUID NOT NULL REFERENCES public.balances(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    discount NUMERIC DEFAULT 0,
    dp_amount NUMERIC DEFAULT NULL,
    dp_percentage NUMERIC DEFAULT NULL,
    payment_terms TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(balance_id, vendor_id)
);

-- Add DP columns to Purchase Orders if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'dp_amount') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN dp_amount NUMERIC DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'dp_percentage') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN dp_percentage NUMERIC DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'remaining_payment') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN remaining_payment NUMERIC DEFAULT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'payment_terms') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN payment_terms TEXT DEFAULT NULL;
    END IF;
END $$;

-- Enable RLS (Optional, depending on existing policies)
ALTER TABLE public.balance_vendor_settings ENABLE ROW LEVEL SECURITY;

-- Create logical policy for public access (adjust to your auth needs)
CREATE POLICY "Enable all access for authenticated users" ON public.balance_vendor_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
