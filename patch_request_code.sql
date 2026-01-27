-- Add missing request_code column to requests table
ALTER TABLE public.requests ADD COLUMN request_code TEXT;
