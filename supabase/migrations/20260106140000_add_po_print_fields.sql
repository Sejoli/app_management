-- Add columns for storing PO print settings
ALTER TABLE "public"."purchase_orders" 
ADD COLUMN IF NOT EXISTS "notes" text,
ADD COLUMN IF NOT EXISTS "franco" text,
ADD COLUMN IF NOT EXISTS "delivery_time" text,
ADD COLUMN IF NOT EXISTS "payment_term" text;
