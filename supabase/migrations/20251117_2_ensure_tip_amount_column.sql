-- Migration to ensure tip_amount column exists on orders table
-- Created on 2025-11-17

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0;

-- Verify the column was created
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'tip_amount';
