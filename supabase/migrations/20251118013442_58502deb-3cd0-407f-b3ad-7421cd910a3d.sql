-- Create requests table
CREATE TABLE public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,
  letter_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_pic_id UUID NOT NULL REFERENCES public.customer_pics(id) ON DELETE CASCADE,
  submission_deadline DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create request_attachments table
CREATE TABLE public.request_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for requests
CREATE POLICY "Allow public read access to requests"
  ON public.requests FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to requests"
  ON public.requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to requests"
  ON public.requests FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete to requests"
  ON public.requests FOR DELETE
  USING (true);

-- Create RLS policies for request_attachments
CREATE POLICY "Allow public read access to request_attachments"
  ON public.request_attachments FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to request_attachments"
  ON public.request_attachments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to request_attachments"
  ON public.request_attachments FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete to request_attachments"
  ON public.request_attachments FOR DELETE
  USING (true);

-- Create trigger for requests updated_at
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for request attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', true);

-- Create storage policies
CREATE POLICY "Public access to request attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'request-attachments');

CREATE POLICY "Public upload to request attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'request-attachments');

CREATE POLICY "Public delete from request attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'request-attachments');