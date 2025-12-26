-- Add missing columns to products table
-- These columns are required by the admin product management system

ALTER TABLE products ADD COLUMN IF NOT EXISTS regular_price numeric(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS dietary_tags text[] DEFAULT ARRAY[]::text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS bottle_price numeric(10,2) DEFAULT 0;

-- Create an index for dietary_tags search performance
CREATE INDEX IF NOT EXISTS idx_products_dietary_tags ON products USING gin(dietary_tags);

-- Add comment to clarify fields
COMMENT ON COLUMN products.regular_price IS 'Original/regular price before sale, used to show discounts';
COMMENT ON COLUMN products.dietary_tags IS 'Array of dietary tags like organic, vegan, gluten-free, etc.';
COMMENT ON COLUMN products.bottle_price IS 'Price for bottle deposits/sales (relevant for beverage products)';
