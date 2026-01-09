import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('role', 'driver')
      .eq('is_active', true);

    if (error) {
      console.error('Error loading drivers:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Error loading drivers:', err);
    return NextResponse.json([]);
  }
}