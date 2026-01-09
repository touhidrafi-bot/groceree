import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('promo_codes')
      .select('id, code, description, discount_type, discount_value, is_public, is_active, start_date, end_date')
      .eq('is_active', true)
      .eq('is_public', true)
      // start_date is null OR start_date <= now
      .or(`start_date.is.null,start_date.lte.${now}`)
      // end_date is null OR end_date >= now
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching available promo codes:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching available promo codes:', error);
    return NextResponse.json([]);
  }
}