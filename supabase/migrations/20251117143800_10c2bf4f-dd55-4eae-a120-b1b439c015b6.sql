-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  office_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  email TEXT NOT NULL,
  npwp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer_pics table
CREATE TABLE public.customer_pics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  office_address TEXT NOT NULL,
  email TEXT NOT NULL,
  npwp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor_pics table
CREATE TABLE public.vendor_pics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_pics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_pics ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (can be restricted later with authentication)
CREATE POLICY "Allow public read access to customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Allow public insert to customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to customers" ON public.customers FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to customers" ON public.customers FOR DELETE USING (true);

CREATE POLICY "Allow public read access to customer_pics" ON public.customer_pics FOR SELECT USING (true);
CREATE POLICY "Allow public insert to customer_pics" ON public.customer_pics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to customer_pics" ON public.customer_pics FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to customer_pics" ON public.customer_pics FOR DELETE USING (true);

CREATE POLICY "Allow public read access to vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Allow public insert to vendors" ON public.vendors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to vendors" ON public.vendors FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to vendors" ON public.vendors FOR DELETE USING (true);

CREATE POLICY "Allow public read access to vendor_pics" ON public.vendor_pics FOR SELECT USING (true);
CREATE POLICY "Allow public insert to vendor_pics" ON public.vendor_pics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to vendor_pics" ON public.vendor_pics FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to vendor_pics" ON public.vendor_pics FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_pics_updated_at
  BEFORE UPDATE ON public.customer_pics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_pics_updated_at
  BEFORE UPDATE ON public.vendor_pics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_customer_pics_customer_id ON public.customer_pics(customer_id);
CREATE INDEX idx_vendor_pics_vendor_id ON public.vendor_pics(vendor_id);
CREATE INDEX idx_customers_customer_code ON public.customers(customer_code);
CREATE INDEX idx_customers_company_name ON public.customers(company_name);
CREATE INDEX idx_vendors_company_name ON public.vendors(company_name);