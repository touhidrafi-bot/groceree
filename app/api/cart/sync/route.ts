import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error in cart sync:', {
        error: sessionError.message,
        code: sessionError.code
      });
      return NextResponse.json({ error: 'Authentication error', details: sessionError.message }, { status: 401 });
    }

    if (!session?.user) {
      console.error('No session found for cart sync');
      return NextResponse.json({ error: 'Not authenticated - session not found' }, { status: 401 });
    }

    const user = session.user;

    if (!user.id) {
      console.error('No user ID in session');
      return NextResponse.json({ error: 'Invalid session - no user ID' }, { status: 401 });
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
