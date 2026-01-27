-- 1. Enforce RESTRICT on Requests -> Customers
-- Prevents deleting a Customer if they have any Requests (which carry Balances, Quotations, etc.)
ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_customer_id_fkey;

ALTER TABLE public.requests
ADD CONSTRAINT requests_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.customers(id)
ON DELETE RESTRICT;

-- 2. Enforce RESTRICT on Requests -> Customer PICs
ALTER TABLE public.requests
DROP CONSTRAINT IF EXISTS requests_customer_pic_id_fkey;

ALTER TABLE public.requests
ADD CONSTRAINT requests_customer_pic_id_fkey
FOREIGN KEY (customer_pic_id)
REFERENCES public.customer_pics(id)
ON DELETE RESTRICT;

-- 3. Enforce RESTRICT on Balance Items -> Vendors
-- Prevents deleting a Vendor if they are used in a Balance costing
ALTER TABLE public.balance_items
DROP CONSTRAINT IF EXISTS balance_items_vendor_id_fkey;

ALTER TABLE public.balance_items
ADD CONSTRAINT balance_items_vendor_id_fkey
FOREIGN KEY (vendor_id)
REFERENCES public.vendors(id)
ON DELETE RESTRICT;

-- 4. Enforce RESTRICT on Purchase Orders -> Vendors
-- Prevents deleting a Vendor if they have a Purchase Order
ALTER TABLE public.purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_vendor_id_fkey;

ALTER TABLE public.purchase_orders
ADD CONSTRAINT purchase_orders_vendor_id_fkey
FOREIGN KEY (vendor_id)
REFERENCES public.vendors(id)
ON DELETE RESTRICT;

-- 5. Enforce RESTRICT on Purchase Orders -> Vendor PICs
ALTER TABLE public.purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_vendor_pic_id_fkey;

ALTER TABLE public.purchase_orders
ADD CONSTRAINT purchase_orders_vendor_pic_id_fkey
FOREIGN KEY (vendor_pic_id)
REFERENCES public.vendor_pics(id)
ON DELETE RESTRICT;
