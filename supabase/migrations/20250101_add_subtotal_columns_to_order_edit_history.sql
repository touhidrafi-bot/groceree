-- Add missing columns to order_edit_history table
ALTER TABLE order_edit_history 
ADD COLUMN IF NOT EXISTS old_subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS new_subtotal DECIMAL(10,2);
