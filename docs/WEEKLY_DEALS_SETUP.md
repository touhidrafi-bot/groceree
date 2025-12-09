# Weekly Deals Feature Setup Guide

This document guides you through setting up the Weekly Deals feature for your Groceree website.

## Overview

The Weekly Deals feature allows admins to create, manage, and display time-limited special offers on the homepage. The feature includes:

- **Admin Dashboard** (`/admin/weekly-deals`) - Create, edit, delete, and activate/deactivate deals
- **Image Upload** - Upload product images to Supabase storage
- **Dynamic Homepage** - Automatically displays active deals with carousel
- **5-minute Cache** - For optimal performance
- **Date Management** - Set valid start and end dates for deals

## Prerequisites

- Supabase account with access to your project
- Admin role in the Groceree app
- Image files to upload (JPG, PNG, GIF)

## Setup Steps

### Step 1: Create the Supabase Table

You have two options:

#### Option A: Using SQL Migration (Recommended for Version Control)

The migration file has already been created at:
```
supabase/migrations/20250124_create_weekly_deals.sql
```

If you're using Supabase CLI locally:
```bash
supabase db push
```

If using Supabase cloud, you'll need to manually run the SQL.

#### Option B: Using Supabase Dashboard SQL Editor

1. Go to your Supabase project → SQL Editor
2. Click "New Query"
3. Copy and paste the following SQL:

```sql
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
```

4. Click "Run"
5. Verify the table appears in your database

### Step 2: Create the Storage Bucket

1. Go to Supabase project → Storage
2. Click "Create a new bucket"
3. Name it: `weekly-deals-images`
4. **Uncheck** "Private bucket" to make it public
5. Click "Create bucket"

### Step 3: Set Bucket Permissions

1. In Storage, click the `weekly-deals-images` bucket
2. Go to the "Policies" tab
3. Click "New policy"
4. Choose: "For authenticated users, allow to upload their own files"
5. Modify the policy to allow any authenticated user to upload:

```sql
-- Allow authenticated users to upload
CREATE POLICY "allow_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'weekly-deals-images' AND 
    auth.role() = 'authenticated'
  );

-- Allow public read access
CREATE POLICY "allow_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'weekly-deals-images');
```

If you prefer to restrict uploads to admins only, add a check to the users table:

```sql
CREATE POLICY "admin_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'weekly-deals-images' AND 
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
```

### Step 4: Access the Admin Dashboard

1. Sign in as an admin user
2. Navigate to `/admin`
3. Click the "Weekly Deals" tab (or click the link if presented)
4. Or go directly to `/admin/weekly-deals`

### Step 5: Create Your First Deal

1. Click "New Deal" button
2. Fill in the form:
   - **Product Image**: Click to upload an image from your computer
   - **Deal Title**: e.g., "50% Off Organic Fruits"
   - **Description**: e.g., "Fresh organic apples, oranges, and berries"
   - **Tag**: e.g., "Special Offer", "Limited Time", etc.
   - **Original Price**: The regular price (e.g., $24.99)
   - **Sale Price**: The discounted price (e.g., $12.49)
   - **Valid From**: Start date of the deal
   - **Valid To**: End date of the deal
   - **Active**: Check to activate the deal
3. Click "Create Deal"

The deal will now appear on the homepage in the "Weekly Deals" section!

## Features

### Admin Dashboard

- **Create Deals**: Add new special offers
- **Edit Deals**: Modify existing deals
- **Delete Deals**: Remove deals (with confirmation)
- **Toggle Active**: Quickly activate/deactivate without deleting
- **Image Upload**: Upload images to Supabase storage (images are stored in `weekly-deals-images` bucket)
- **Date Validation**: Ensures start date is before end date
- **Price Validation**: Ensures sale price ≤ original price

### Homepage Display

- **Dynamic Carousel**: Automatically fetches and displays active deals
- **Auto-rotation**: Slides change every 5 seconds
- **Manual Navigation**: Use arrow buttons or dots to navigate
- **Responsive Design**: Works on mobile, tablet, and desktop
- **Limited Time Badge**: Shows "X days left", "Ends today", or "Ends tomorrow"
- **Discount Percentage**: Automatically calculated

### Caching

- **5-minute Cache**: API caches deals for 5 minutes to reduce database queries
- **Auto-invalidation**: Cache clears when deals are created, updated, or deleted
- **Performance**: Reduces load on Supabase

## API Endpoints

### GET /api/weekly-deals

Fetch all active deals. Returns cached data within 5-minute window.

**Response**:
```json
{
  "deals": [
    {
      "id": "uuid",
      "title": "50% Off Organic Fruits",
      "description": "Fresh organic apples, oranges, and berries",
      "original_price": 24.99,
      "sale_price": 12.49,
      "tag": "Special Offer",
      "image_url": "https://...",
      "valid_from": "2025-01-24",
      "valid_to": "2025-01-26",
      "is_active": true,
      "created_at": "2025-01-24T10:00:00Z"
    }
  ]
}
```

### POST /api/weekly-deals

Create a new deal. Requires admin authentication.

### PUT /api/weekly-deals/[id]

Update a deal. Requires admin authentication.

### DELETE /api/weekly-deals/[id]

Delete a deal. Requires admin authentication.

## Troubleshooting

### "Storage bucket not found"

**Problem**: When uploading images, you get "bucket not found" error.

**Solution**:
1. Make sure you created the `weekly-deals-images` bucket in Storage
2. Check bucket policies allow uploads
3. Refresh the page and try again

### "Unauthorized - Admin access required"

**Problem**: You can't create/edit deals even though you're an admin.

**Solution**:
1. Verify your user has `role = 'admin'` in the `users` table
2. Check your auth session is active (try logging out and back in)

### Images not showing on homepage

**Problem**: Deal images show 404 or blank.

**Solution**:
1. Check the image was uploaded successfully (should see preview in form)
2. Verify the `weekly-deals-images` bucket allows public read access
3. Check image URL is valid in the `image_url` column

### Deals not appearing on homepage

**Problem**: You created deals but they don't show on homepage.

**Solution**:
1. Make sure `is_active = true` for the deal
2. Check `valid_from` is today or earlier
3. Check `valid_to` is today or later
4. Clear your browser cache (homepage has 5-minute cache)
5. Check browser console for errors

### "Sale price must be less than or equal to original price"

**Problem**: Form validation prevents creating deal.

**Solution**:
1. Make sure sale price is less than or equal to original price
2. Check you didn't accidentally swap the prices

## File Structure

```
app/
  api/
    weekly-deals/
      route.ts            # GET (list) and POST (create)
      [id]/
        route.ts          # PUT (update) and DELETE
  admin/
    weekly-deals/
      page.tsx            # Admin dashboard
components/
  admin/
    WeeklyDealsForm.tsx   # Form with image upload
  SpecialOffersSection.tsx  # Homepage carousel (replaces static)
docs/
  WEEKLY_DEALS_SETUP.md   # This file
supabase/
  migrations/
    20250124_create_weekly_deals.sql  # Database migration
```

## Testing Checklist

- [ ] Created `weekly_deals` table in Supabase
- [ ] Created `weekly-deals-images` storage bucket
- [ ] Set bucket to public
- [ ] Can access `/admin/weekly-deals` as admin
- [ ] Can create a new deal with image
- [ ] Image uploads successfully
- [ ] Deal appears on homepage
- [ ] Deal disappears when deactivated
- [ ] Deal disappears when valid_to date is passed
- [ ] Can edit a deal
- [ ] Can delete a deal
- [ ] Carousel rotates through multiple deals
- [ ] Carousel is responsive on mobile

## Next Steps

1. Complete the setup steps above
2. Create 2-3 sample deals
3. Test the homepage carousel
4. Customize the deal tags and styling if desired

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Supabase logs in the dashboard
3. Check browser console for JavaScript errors
4. Verify environment variables are set correctly
