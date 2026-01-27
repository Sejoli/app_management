-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('OUT', 'IN')),
  po_number TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'CREATED',
  vendor_id UUID REFERENCES public.vendors(id),
  vendor_pic_id UUID REFERENCES public.vendor_pics(id),
  vendor_letter_number TEXT,
  vendor_letter_date DATE,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase_order_quotations table
CREATE TABLE IF NOT EXISTS public.purchase_order_quotations (
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES public.quotations(id) ON DELETE CASCADE,
  PRIMARY KEY (purchase_order_id, quotation_id)
);

-- Create purchase_order_attachments table
CREATE TABLE IF NOT EXISTS public.purchase_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies (Assuming standard public access for this app based on previous code)
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.purchase_order_quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for all users" ON public.purchase_order_attachments FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for purchase order attachments if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('purchase-order-attachments', 'purchase-order-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR ALL USING (bucket_id = 'purchase-order-attachments');
