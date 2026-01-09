import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    const { data: adjustments, error } = await supabase
      .from('stock_adjustments')
      .select(`
        *,
        products (name, sku),
        users (email)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching stock adjustments:', error);
      return NextResponse.json({ error: 'Failed to load stock adjustments' }, { status: 500 });
    }

    return NextResponse.json(adjustments || []);
  } catch (error: any) {
    console.error('Error fetching stock adjustments:', error);
    return NextResponse.json({ error: 'Failed to load stock adjustments' }, { status: 500 });
  }
}