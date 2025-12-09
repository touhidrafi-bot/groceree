import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache
const dealsCache = {
  data: null as any,
  timestamp: 0,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }

  return createClient(url, key);
}

export async function GET(_request: NextRequest) {
  try {
    const now = Date.now();

    // Check if cache is still valid
    if (dealsCache.data && now - dealsCache.timestamp < dealsCache.CACHE_DURATION) {
      return NextResponse.json(dealsCache.data);
    }

    // Check environment variables first
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error('Missing Supabase environment variables');
      const response = { deals: [], warning: 'Supabase not configured - environment variables missing' };
      dealsCache.data = response;
      dealsCache.timestamp = now;
      return NextResponse.json(response);
    }

    try {
      const supabase = createSupabaseClient();
      const today = new Date().toISOString().split('T')[0];

      // Fetch all active deals that are currently valid
      const { data: deals, error } = await supabase
        .from('weekly_deals')
        .select('*')
        .eq('is_active', true)
        .gte('valid_to', today)
        .lte('valid_from', today)
        .order('valid_from', { ascending: false });

      if (error) {
        console.error('Supabase error:', {
          message: error.message,
          code: error.code,
          details: error.details,
        });

        // If table doesn't exist, return empty array instead of error
        if (error.code === 'PGRST116' || error.message?.includes('relation')) {
          const response = { deals: [], warning: 'weekly_deals table not found' };
          dealsCache.data = response;
          dealsCache.timestamp = now;
          return NextResponse.json(response);
        }

        // Return empty deals instead of error to prevent client errors
        const response = { deals: [], warning: error.message };
        dealsCache.data = response;
        dealsCache.timestamp = now;
        return NextResponse.json(response);
      }

      const response = { deals: deals || [] };

      // Update cache
      dealsCache.data = response;
      dealsCache.timestamp = now;

      return NextResponse.json(response);
    } catch (supabaseError) {
      const errorMessage = supabaseError instanceof Error ? supabaseError.message : String(supabaseError);
      console.error('Supabase initialization error:', errorMessage);

      // Return graceful fallback with empty deals
      const response = { deals: [], warning: 'Could not connect to Supabase' };
      dealsCache.data = response;
      dealsCache.timestamp = now;
      return NextResponse.json(response);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('API error:', errorMessage);
    return NextResponse.json(
      {
        deals: [],
        warning: errorMessage
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient();

    // Note: getSession() on server requires proper request context
    // For now, we'll rely on RLS policies to handle auth
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.original_price || !body.sale_price || !body.valid_from || !body.valid_to) {
      return NextResponse.json(
        { error: 'Missing required fields: title, original_price, sale_price, valid_from, valid_to' },
        { status: 400 }
      );
    }

    const { data: deal, error } = await supabase
      .from('weekly_deals')
      .insert([
        {
          title: body.title,
          description: body.description || null,
          original_price: parseFloat(body.original_price),
          sale_price: parseFloat(body.sale_price),
          tag: body.tag || 'Special Offer',
          image_url: body.image_url || null,
          valid_from: body.valid_from,
          valid_to: body.valid_to,
          is_active: body.is_active !== false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Clear cache when new deal is added
    dealsCache.data = null;
    dealsCache.timestamp = 0;

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('POST error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
