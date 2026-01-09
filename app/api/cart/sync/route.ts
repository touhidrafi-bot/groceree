import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      console.error('Authentication failed in sync:', { sessionError });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = session.user;

    if (sessionError || !user) {
      console.error('Authentication failed:', { sessionError });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: cartItems, error } = await supabase
      .from('carts')
      .select(`
        *,
        products(*)
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error syncing cart with database:', error);
      return NextResponse.json({ error: 'Failed to sync cart' }, { status: 500 });
    }

    return NextResponse.json(cartItems || []);
  } catch (error) {
    console.error('Error syncing cart with database:', error);
    return NextResponse.json({ error: 'Failed to sync cart' }, { status: 500 });
  }
}