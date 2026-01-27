-- Create default_payment_time_settings table
CREATE TABLE public.default_payment_time_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.default_payment_time_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to default_payment_time_settings" 
ON public.default_payment_time_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to default_payment_time_settings" 
ON public.default_payment_time_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to default_payment_time_settings" 
ON public.default_payment_time_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete to default_payment_time_settings" 
ON public.default_payment_time_settings 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_default_payment_time_settings_updated_at
BEFORE UPDATE ON public.default_payment_time_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create default_overall_cost_settings table
CREATE TABLE public.default_overall_cost_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cost_category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.default_overall_cost_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to default_overall_cost_settings" 
ON public.default_overall_cost_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to default_overall_cost_settings" 
ON public.default_overall_cost_settings 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to default_overall_cost_settings" 
ON public.default_overall_cost_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete to default_overall_cost_settings" 
ON public.default_overall_cost_settings 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_default_overall_cost_settings_updated_at
BEFORE UPDATE ON public.default_overall_cost_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update customer_default_settings table
ALTER TABLE public.customer_default_settings 
DROP COLUMN payment_terms,
DROP COLUMN document_cost,
DROP COLUMN un_cost,
ADD COLUMN payment_category_id UUID REFERENCES public.default_payment_time_settings(id);