# Supabase Promo Codes Setup

This document describes the required Supabase tables for the promo code feature.

## Required Tables

### 1. `promo_codes` Table

This table stores all available promo codes.

```sql
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_delivery')),
  discount_value NUMERIC(10, 2) NOT NULL,
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  uses_per_user_limit INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (
    (date_trunc('day'::text, now()) + '1 day'::interval) - '00:00:01'::interval
  ),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id),
  CONSTRAINT promo_codes_code_key UNIQUE (code),
  CONSTRAINT promo_codes_discount_type_check CHECK (
    discount_type = ANY (ARRAY['percentage'::CHARACTER VARYING, 'fixed'::CHARACTER VARYING, 'free_delivery'::CHARACTER VARYING])
  )
) TABLESPACE pg_default;

CREATE INDEX idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX idx_promo_codes_is_active ON public.promo_codes(is_active);
CREATE INDEX idx_promo_codes_created_by ON public.promo_codes(created_by);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `code`: Promo code string (e.g., "SUMMER20", "WELCOME15") - MUST BE UNIQUE
- `description`: User-friendly description (e.g., "20% off summer collection")
- `discount_type`: Type of discount - 'percentage', 'fixed', or 'free_delivery'
- `discount_value`: Discount amount (numeric value, percentage or fixed amount)
- `min_order_amount`: Minimum order subtotal required to use code (default 0)
- `max_uses`: Optional maximum number of times code can be used globally
- `current_uses`: Current usage count (auto-incremented)
- `uses_per_user_limit`: Optional limit on how many times a single user can use this code
- `is_active`: Whether the code is currently active
- `is_public`: Whether the code is publicly visible
- `start_date`: Optional date when code becomes valid
- `end_date`: Optional date when code expires
- `expires_at`: Expiration timestamp with default logic
- `created_at`: Timestamp when created
- `updated_at`: Timestamp when last updated
- `created_by`: UUID of admin user who created the code

**Example Records:**
```sql
INSERT INTO public.promo_codes (
  code, description, discount_type, discount_value, min_order_amount, 
  is_active, is_public, max_uses, uses_per_user_limit
) VALUES
  ('SUMMER20', '20% off summer collection', 'percentage', 20, 50.00, true, true, 100, 1),
  ('SAVE5', '$5 off any order', 'fixed', 5.00, 0, true, true, NULL, NULL),
  ('FREEDEL', 'Free delivery on $30+ orders', 'free_delivery', 0, 30.00, true, true, 500, 2);
```

### 2. `promo_code_usage` Table

This table tracks usage of promo codes.

```sql
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  discount_amount NUMERIC(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id),
  CONSTRAINT promo_code_usage_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  CONSTRAINT promo_code_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT promo_code_usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX idx_promo_code_usage_promo_code_id ON public.promo_code_usage(promo_code_id);
CREATE INDEX idx_promo_code_usage_user_id ON public.promo_code_usage(user_id);
CREATE INDEX idx_promo_code_usage_order_id ON public.promo_code_usage(order_id);
```

**Columns:**
- `id`: Unique identifier (UUID)
- `promo_code_id`: Foreign key to promo_codes table
- `user_id`: Optional reference to user who used the code
- `order_id`: Optional reference to the order where code was used
- `discount_amount`: Amount of discount applied
- `used_at`: Timestamp when code was used

## Validation Rules

The promo code validation in `lib/promo-code.ts` enforces:

1. **Code Existence**: Code must exist in the `promo_codes` table
2. **Active Status**: `is_active` must be `true`
3. **Date Validity**: Current date must be between `start_date` and `end_date` (if set)
4. **Minimum Order Amount**: Cart subtotal must meet `min_order_amount`
5. **Global Usage Limit**: Total usage count must not exceed `max_uses` (if set)
6. **Per-User Usage Limit**: User cannot exceed `uses_per_user_limit` (if set)
7. **Discount Type**: Must be one of 'percentage', 'fixed', or 'free_delivery'

## Row Level Security (RLS) Setup

Enable RLS for secure access control. This is critical to prevent policy recursion errors.

```sql
-- Enable RLS on promo_codes table
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Allow public to read active, public promo codes
CREATE POLICY "public_promo_codes_read" ON public.promo_codes
  FOR SELECT
  USING (is_public = true AND is_active = true);

-- Allow admins to manage all promo codes
CREATE POLICY "admin_promo_codes_all" ON public.promo_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Enable RLS on promo_code_usage table
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert usage records
CREATE POLICY "users_insert_promo_usage" ON public.promo_code_usage
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Allow users to view their own usage
CREATE POLICY "users_read_own_usage" ON public.promo_code_usage
  FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Allow admins to view all usage
CREATE POLICY "admin_read_all_usage" ON public.promo_code_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
```

## IMPORTANT: Fixing RLS Policy Recursion Error

If you encounter an error about infinite recursion in `admin_roles` relation, follow these steps:

1. **Drop existing recursive policies**: In Supabase SQL Editor, run:
```sql
-- Drop all existing policies (if any have recursion issues)
DROP POLICY IF EXISTS "admin_" ON public.promo_codes;
DROP POLICY IF EXISTS "admin_users_read" ON public.promo_codes;
DROP POLICY IF EXISTS "admin_access" ON public.promo_codes;

-- Drop all policies on promo_code_usage too
DROP POLICY IF EXISTS "admin_" ON public.promo_code_usage;
DROP POLICY IF EXISTS "admin_users_read" ON public.promo_code_usage;
```

2. **Create non-recursive policies**: Use the policies above that check the users table directly instead of referencing admin_roles.

3. **Verify policies**: Check Supabase dashboard → Authentication → Policies to ensure there are no circular references.

## Admin Promo Code Management

The admin dashboard now includes a comprehensive Promo Codes tab where admins can:

- **Create promo codes** with all parameters
- **Edit existing codes** to update terms
- **Delete promo codes** (with confirmation)
- **Toggle active status** without deleting
- **View usage statistics** including total uses and unique users
- **Search and filter** codes by name or description
- **Set expiration dates** and usage limits
- **Configure discount types** (percentage, fixed amount, or free delivery)

Location: `app/admin/AdminPromoCodes.tsx`

## Integration Points

### 1. Cart Page
- Location: `app/cart/page.tsx`
- Displays promo code input field in the Order Summary section
- Shows applied discount as a line item

### 2. Promo Code Input Component
- Location: `components/PromoCodeInput.tsx`
- Handles user input for code validation
- Displays success/error notifications

### 3. Cart Context
- Location: `components/EnhancedCartProvider.tsx`
- Manages promo code state across the application
- Tracks promo code usage on successful checkout

### 4. Promo Code Service
- Location: `lib/promo-code.ts`
- Validates codes against Supabase data
- Tracks usage in the `promo_code_usage` table
- Calculates discount amounts
- Provides admin functions for CRUD operations

## Setup Instructions

1. **Copy the SQL from the tables section above**
2. **Go to your Supabase project** → SQL Editor
3. **Create the promo_codes table** using the SQL provided
4. **Create the promo_code_usage table** using the SQL provided
5. **Enable Row Level Security** using the RLS policies above
6. **Add example promo codes** for testing using the INSERT examples above
7. **Test the admin interface** by navigating to `/admin` and clicking the "Promo Codes" tab

## Testing

You can test the promo code feature by:

1. **Admin creation**: Go to `/admin` → Promo Codes tab → "New Promo Code"
2. **Enter test data**: Create a code like "TEST20" with 20% discount
3. **Use in checkout**: Go to cart and enter the code
4. **Verify discount**: Check that the discount is applied to the order total
5. **View usage**: In admin dashboard, click the chart icon to view usage statistics
6. **Database check**: Verify the `promo_code_usage` table has new records

## Troubleshooting

### Policy Recursion Error
**Issue**: "Infinite recursion in policy for relation 'admin_roles'"

**Solution**: 
- Delete all existing policies from the promo_codes and promo_code_usage tables
- Use the non-recursive RLS policies provided in this document
- Do NOT reference views that reference the same table

### "Invalid promo code" Error
**Causes**:
- Code doesn't exist in database
- Code is not active (`is_active = false`)
- Code has expired (`end_date` < now)
- User lacks permission due to RLS policy

**Solution**: Check that code exists and is active in Supabase dashboard

### "Minimum order amount required"
**Cause**: Cart subtotal is below `min_order_amount`

**Solution**: Increase order total above the required minimum

### "Usage limit exceeded"
**Cause**: Either global `max_uses` or user's `uses_per_user_limit` exceeded

**Solution**: In admin panel, increase limits or create a new code

### "Cannot read properties of undefined"
**Cause**: Likely RLS policy is blocking read access

**Solution**: Verify RLS policies are correctly configured for your user role
