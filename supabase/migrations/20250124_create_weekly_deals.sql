-- Create weekly_deals table
CREATE TABLE public.weekly_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  original_price NUMERIC(10, 2) NOT NULL,
  sale_price NUMERIC(10, 2) NOT NULL,
  tag TEXT DEFAULT 'Special Offer',
  image_url TEXT,
  valid_from DATE NOT NULL,
  valid_to DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT weekly_deals_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_deals_price_check CHECK (sale_price <= original_price)
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX idx_weekly_deals_is_active ON public.weekly_deals(is_active);
CREATE INDEX idx_weekly_deals_valid_from ON public.weekly_deals(valid_from);
CREATE INDEX idx_weekly_deals_valid_to ON public.weekly_deals(valid_to);
CREATE INDEX idx_weekly_deals_created_by ON public.weekly_deals(created_by);

-- Enable Row Level Security
ALTER TABLE public.weekly_deals ENABLE ROW LEVEL SECURITY;

-- Allow public to read active deals
CREATE POLICY "public_weekly_deals_read" ON public.weekly_deals
  FOR SELECT
  USING (is_active = true);

-- Allow admins to manage all deals
CREATE POLICY "admin_weekly_deals_all" ON public.weekly_deals
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
