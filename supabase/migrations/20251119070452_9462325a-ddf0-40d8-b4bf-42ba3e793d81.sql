-- Create balances table for balance management
CREATE TABLE public.balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL,
  balance_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT balances_request_id_fkey FOREIGN KEY (request_id) 
    REFERENCES public.requests(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to balances" 
ON public.balances 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to balances" 
ON public.balances 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update to balances" 
ON public.balances 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete to balances" 
ON public.balances 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_balances_updated_at
BEFORE UPDATE ON public.balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_balances_request_id ON public.balances(request_id);