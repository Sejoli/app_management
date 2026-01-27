-- Create table for default difficulty settings (global)
CREATE TABLE IF NOT EXISTS public.default_difficulty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  difficulty_level TEXT NOT NULL UNIQUE,
  percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for default delivery time settings (global)
CREATE TABLE IF NOT EXISTS public.default_delivery_time_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_category TEXT NOT NULL UNIQUE,
  percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for customer default settings (per customer)
CREATE TABLE IF NOT EXISTS public.customer_default_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  margin_percentage NUMERIC NOT NULL DEFAULT 0,
  payment_terms TEXT,
  document_cost NUMERIC NOT NULL DEFAULT 0,
  return_cost NUMERIC NOT NULL DEFAULT 0,
  un_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(customer_id)
);

-- Enable Row Level Security
ALTER TABLE public.default_difficulty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_delivery_time_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_default_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to default_difficulty_settings" 
ON public.default_difficulty_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to default_difficulty_settings" 
ON public.default_difficulty_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to default_difficulty_settings" 
ON public.default_difficulty_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete to default_difficulty_settings" 
ON public.default_difficulty_settings 
FOR DELETE 
USING (true);

CREATE POLICY "Allow public read access to default_delivery_time_settings" 
ON public.default_delivery_time_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to default_delivery_time_settings" 
ON public.default_delivery_time_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to default_delivery_time_settings" 
ON public.default_delivery_time_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete to default_delivery_time_settings" 
ON public.default_delivery_time_settings 
FOR DELETE 
USING (true);

CREATE POLICY "Allow public read access to customer_default_settings" 
ON public.customer_default_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to customer_default_settings" 
ON public.customer_default_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to customer_default_settings" 
ON public.customer_default_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete to customer_default_settings" 
ON public.customer_default_settings 
FOR DELETE 
USING (true);

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_default_difficulty_settings_updated_at
BEFORE UPDATE ON public.default_difficulty_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_default_delivery_time_settings_updated_at
BEFORE UPDATE ON public.default_delivery_time_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_default_settings_updated_at
BEFORE UPDATE ON public.customer_default_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();