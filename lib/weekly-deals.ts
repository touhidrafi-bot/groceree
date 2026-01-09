import { supabase, SUPABASE_CONFIGURED } from './auth';

export interface WeeklyDeal {
  id: string;
  title: string;
  description: string | null;
  original_price: number;
  sale_price: number;
  tag: string | null;
  image_url: string | null;
  valid_from: string;
  valid_to: string;
  is_active: boolean | null;
  created_at: string | null;
  updated_at?: string | null;
  created_by: string | null;
}

interface CreateDealInput {
  title: string;
  description: string | null;
  original_price: number;
  sale_price: number;
  tag: string | null;
  image_url: string | null;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
}

interface UpdateDealInput {
  title?: string;
  description?: string | null;
  original_price?: number;
  sale_price?: number;
  tag?: string | null;
  image_url?: string | null;
  valid_from?: string;
  valid_to?: string;
  is_active?: boolean | null;
}

/**
 * Fetch all active weekly deals with caching
 * Cache is valid for 5 minutes and is handled by the API
 */
export async function getActiveDeals(): Promise<WeeklyDeal[]> {
  try {
    const response = await fetch('/api/weekly-deals', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch deals: ${response.statusText}`);
    }

    const data = await response.json();
    return data.deals || [];
  } catch (error) {
    console.error('Error fetching active deals:', error);
    return [];
  }
}

/**
 * Create a new weekly deal
 * Requires admin authentication
 */
export async function createDeal(deal: CreateDealInput): Promise<WeeklyDeal | null> {
  try {
    if (!SUPABASE_CONFIGURED) {
      throw new Error('Supabase not configured');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/weekly-deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(deal),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create deal');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating deal:', error);
    throw error;
  }
}

/**
 * Update an existing weekly deal
 * Requires admin authentication
 */
export async function updateDeal(
  id: string,
  updates: UpdateDealInput
): Promise<WeeklyDeal | null> {
  try {
    if (!SUPABASE_CONFIGURED) {
      throw new Error('Supabase not configured');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/weekly-deals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update deal');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating deal:', error);
    throw error;
  }
}

/**
 * Delete a weekly deal
 * Requires admin authentication
 */
export async function deleteDeal(id: string): Promise<boolean> {
  try {
    if (!SUPABASE_CONFIGURED) {
      throw new Error('Supabase not configured');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/weekly-deals/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete deal');
    }

    return true;
  } catch (error) {
    console.error('Error deleting deal:', error);
    throw error;
  }
}

/**
 * Upload an image to the weekly-deals-images bucket
 * Returns the public URL of the uploaded image
 */
export async function uploadDealImage(file: File): Promise<string> {
  try {
    if (!SUPABASE_CONFIGURED) {
      throw new Error('Supabase not configured');
    }

    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `deals/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('weekly-deals-images')
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('weekly-deals-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading deal image:', error);
    throw error;
  }
}

/**
 * Calculate the discount percentage
 */
export function calculateDiscountPercentage(
  originalPrice: number,
  salePrice: number
): number {
  if (originalPrice === 0) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/**
 * Format date display for valid_from and valid_to
 */
export function getDateDisplay(validFrom: string, validTo: string): string {
  const today = new Date().toISOString().split('T')[0];
  const toDate = new Date(validTo);
  const todayDate = new Date(today);

  const daysLeft = Math.ceil((toDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

  if (validTo === today) {
    return 'Ends today';
  } else if (daysLeft === 1) {
    return 'Ends tomorrow';
  } else if (daysLeft > 1) {
    return `${daysLeft} days left`;
  }

  return 'Expired';
}

/**
 * Check if a deal is currently active
 */
export function isDealActive(deal: WeeklyDeal): boolean {
  if (!deal.is_active) return false;

  const today = new Date().toISOString().split('T')[0];
  return deal.valid_from <= today && today <= deal.valid_to;
}

/**
 * Validate deal form data
 */
export function validateDealForm(data: CreateDealInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (isNaN(data.original_price) || data.original_price <= 0) {
    errors.push('Original price must be a valid positive number');
  }

  if (isNaN(data.sale_price) || data.sale_price <= 0) {
    errors.push('Sale price must be a valid positive number');
  }

  if (data.sale_price > data.original_price) {
    errors.push('Sale price cannot be greater than original price');
  }

  if (!data.valid_from) {
    errors.push('Start date is required');
  }

  if (!data.valid_to) {
    errors.push('End date is required');
  }

  if (data.valid_from && data.valid_to && data.valid_from > data.valid_to) {
    errors.push('Start date must be before end date');
  }

  if (!data.image_url) {
    errors.push('Image is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
