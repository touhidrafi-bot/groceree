import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    const { data, error } = await supabase
      .from('promo_codes')
      .select('id, code, description, discount_type, discount_value, min_order_amount, max_uses, current_uses, uses_per_user_limit, is_active, is_public, start_date, end_date, expires_at, created_at, updated_at, created_by')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching promo codes:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Exception fetching promo codes:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      fullError: JSON.stringify(error, null, 2)
    });
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();
    const promoData = await request.json();

    const { data, error } = await supabase
      .from('promo_codes')
      .insert(promoData)
      .select()
      .single();

    if (error) {
      console.error('Error creating promo code:', error);
      return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating promo code:', error);
    return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await supabaseServer();
    const { id, ...updateData } = await request.json();

    const { data, error } = await supabase
      .from('promo_codes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating promo code:', error);
      return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating promo code:', error);
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await supabaseServer();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Promo code ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('promo_codes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting promo code:', error);
      return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
  }
}