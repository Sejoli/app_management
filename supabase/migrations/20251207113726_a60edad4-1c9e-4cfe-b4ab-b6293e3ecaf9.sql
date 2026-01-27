
-- Create company table
CREATE TABLE public.company (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  npwp TEXT NOT NULL,
  logo_path TEXT,
  npwp_document_path TEXT,
  profile_document_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create company product list documents table
CREATE TABLE public.company_product_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  birthplace TEXT NOT NULL,
  birthdate DATE NOT NULL,
  address TEXT NOT NULL,
  position TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team member documents table
CREATE TABLE public.team_member_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotations table
CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  quotation_number TEXT NOT NULL UNIQUE,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT DEFAULT 'partial order need re quotation',
  franco TEXT,
  term_of_payment TEXT,
  price_validity TEXT DEFAULT '7 days',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotation balances junction table
CREATE TABLE public.quotation_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  balance_id UUID NOT NULL REFERENCES public.balances(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_product_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_balances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company
CREATE POLICY "Allow public read access to company" ON public.company FOR SELECT USING (true);
CREATE POLICY "Allow public insert to company" ON public.company FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to company" ON public.company FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to company" ON public.company FOR DELETE USING (true);

-- Create RLS policies for company_product_documents
CREATE POLICY "Allow public read access to company_product_documents" ON public.company_product_documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert to company_product_documents" ON public.company_product_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to company_product_documents" ON public.company_product_documents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to company_product_documents" ON public.company_product_documents FOR DELETE USING (true);

-- Create RLS policies for team_members
CREATE POLICY "Allow public read access to team_members" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert to team_members" ON public.team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to team_members" ON public.team_members FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to team_members" ON public.team_members FOR DELETE USING (true);

-- Create RLS policies for team_member_documents
CREATE POLICY "Allow public read access to team_member_documents" ON public.team_member_documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert to team_member_documents" ON public.team_member_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to team_member_documents" ON public.team_member_documents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to team_member_documents" ON public.team_member_documents FOR DELETE USING (true);

-- Create RLS policies for quotations
CREATE POLICY "Allow public read access to quotations" ON public.quotations FOR SELECT USING (true);
CREATE POLICY "Allow public insert to quotations" ON public.quotations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to quotations" ON public.quotations FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to quotations" ON public.quotations FOR DELETE USING (true);

-- Create RLS policies for quotation_balances
CREATE POLICY "Allow public read access to quotation_balances" ON public.quotation_balances FOR SELECT USING (true);
CREATE POLICY "Allow public insert to quotation_balances" ON public.quotation_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to quotation_balances" ON public.quotation_balances FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to quotation_balances" ON public.quotation_balances FOR DELETE USING (true);

-- Create storage bucket for company files
INSERT INTO storage.buckets (id, name, public) VALUES ('company-files', 'company-files', true);

-- Create storage policies for company files
CREATE POLICY "Allow public read access to company-files" ON storage.objects FOR SELECT USING (bucket_id = 'company-files');
CREATE POLICY "Allow public upload to company-files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-files');
CREATE POLICY "Allow public update to company-files" ON storage.objects FOR UPDATE USING (bucket_id = 'company-files');
CREATE POLICY "Allow public delete to company-files" ON storage.objects FOR DELETE USING (bucket_id = 'company-files');

-- Create triggers for updated_at
CREATE TRIGGER update_company_updated_at BEFORE UPDATE ON public.company FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
