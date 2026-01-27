SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'created_by' AND table_name IN ('requests', 'balances', 'quotations', 'po_ins', 'internal_letters');
