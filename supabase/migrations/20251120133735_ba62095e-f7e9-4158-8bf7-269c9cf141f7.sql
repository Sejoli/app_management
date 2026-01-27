-- Create balance items table
CREATE TABLE public.balance_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance_id UUID NOT NULL,
  balance_entry_id INTEGER NOT NULL,
  vendor_id UUID,
  vendor_spec TEXT,
  document_path TEXT,
  purchase_price DECIMAL(15,2) NOT NULL,
  qty DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  weight DECIMAL(10,2),
  shipping_vendor_group TEXT NOT NULL,
  shipping_customer_group TEXT NOT NULL,
  delivery_time TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  unit_selling_price DECIMAL(15,2),
  total_selling_price DECIMAL(15,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipping vendor to MPA groups table
CREATE TABLE public.shipping_vendor_mpa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance_id UUID NOT NULL,
  group_name TEXT NOT NULL,
  cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(balance_id, group_name)
);

-- Create shipping MPA to customer groups table
CREATE TABLE public.shipping_mpa_customer (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance_id UUID NOT NULL,
  group_name TEXT NOT NULL,
  cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(balance_id, group_name)
);

-- Create difficulty settings table
CREATE TABLE public.difficulty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance_id UUID NOT NULL,
  difficulty_level TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(balance_id, difficulty_level)
);

-- Create balance settings table
CREATE TABLE public.balance_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  balance_id UUID NOT NULL UNIQUE,
  margin_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  payment_terms TEXT,
  ppn_percentage DECIMAL(5,2) NOT NULL DEFAULT 11,
  document_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  return_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.balance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_vendor_mpa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_mpa_customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.difficulty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for balance_items
CREATE POLICY "Allow public read access to balance_items" ON public.balance_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert to balance_items" ON public.balance_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to balance_items" ON public.balance_items FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to balance_items" ON public.balance_items FOR DELETE USING (true);

-- Create RLS policies for shipping_vendor_mpa
CREATE POLICY "Allow public read access to shipping_vendor_mpa" ON public.shipping_vendor_mpa FOR SELECT USING (true);
CREATE POLICY "Allow public insert to shipping_vendor_mpa" ON public.shipping_vendor_mpa FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to shipping_vendor_mpa" ON public.shipping_vendor_mpa FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to shipping_vendor_mpa" ON public.shipping_vendor_mpa FOR DELETE USING (true);

-- Create RLS policies for shipping_mpa_customer
CREATE POLICY "Allow public read access to shipping_mpa_customer" ON public.shipping_mpa_customer FOR SELECT USING (true);
CREATE POLICY "Allow public insert to shipping_mpa_customer" ON public.shipping_mpa_customer FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to shipping_mpa_customer" ON public.shipping_mpa_customer FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to shipping_mpa_customer" ON public.shipping_mpa_customer FOR DELETE USING (true);

-- Create RLS policies for difficulty_settings
CREATE POLICY "Allow public read access to difficulty_settings" ON public.difficulty_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert to difficulty_settings" ON public.difficulty_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to difficulty_settings" ON public.difficulty_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to difficulty_settings" ON public.difficulty_settings FOR DELETE USING (true);

-- Create RLS policies for balance_settings
CREATE POLICY "Allow public read access to balance_settings" ON public.balance_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert to balance_settings" ON public.balance_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to balance_settings" ON public.balance_settings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to balance_settings" ON public.balance_settings FOR DELETE USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_balance_items_updated_at
BEFORE UPDATE ON public.balance_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_vendor_mpa_updated_at
BEFORE UPDATE ON public.shipping_vendor_mpa
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_mpa_customer_updated_at
BEFORE UPDATE ON public.shipping_mpa_customer
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_difficulty_settings_updated_at
BEFORE UPDATE ON public.difficulty_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_balance_settings_updated_at
BEFORE UPDATE ON public.balance_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_balance_items_balance_id ON public.balance_items(balance_id);
CREATE INDEX idx_balance_items_vendor_id ON public.balance_items(vendor_id);
CREATE INDEX idx_shipping_vendor_mpa_balance_id ON public.shipping_vendor_mpa(balance_id);
CREATE INDEX idx_shipping_mpa_customer_balance_id ON public.shipping_mpa_customer(balance_id);
CREATE INDEX idx_difficulty_settings_balance_id ON public.difficulty_settings(balance_id);
CREATE INDEX idx_balance_settings_balance_id ON public.balance_settings(balance_id);