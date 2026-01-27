CREATE OR REPLACE FUNCTION cleanup_unquoted_balances(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete balance entries associated with the request that are NOT in quotation_balances
  DELETE FROM balance_entries be
  USING balances b
  WHERE be.balance_id = b.id
  AND b.request_id = p_request_id
  AND be.id NOT IN (
    SELECT entry_id FROM quotation_balances
  );
END;
$$;
