-- Safe migration to add `stripe_payment_intent_id` and `payment_status` columns
-- and to add the `orders_payment_status_check` constraint only if it does not already exist.
-- Run this in Supabase SQL editor or with psql.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS payment_status text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_payment_status_check'
  ) THEN
    EXECUTE
      'ALTER TABLE orders
         ADD CONSTRAINT orders_payment_status_check
         CHECK (payment_status IN (''authorized'',''captured'',''refunded'',''failed'',''pending'') OR payment_status IS NULL)';
  END IF;
END
$$;
-- Verification queries (run after applying):
-- SELECT conname, conrelid::regclass FROM pg_constraint WHERE conname = 'orders_payment_status_check';
-- \d+ orders;
