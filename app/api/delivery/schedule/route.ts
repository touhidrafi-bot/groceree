import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('delivery_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error loading delivery settings:', error);
      return NextResponse.json({ error: 'Failed to load delivery settings' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Error loading delivery settings:', err);
    return NextResponse.json({ error: 'Failed to load delivery settings' }, { status: 500 });
  }
}