import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, productId, quantity } = await request.json();

    const supabase = await supabaseServer();

    // Get the current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error in cart update:', {
        error: sessionError.message,
        code: sessionError.code,
        action: (await request.json()).action
      });
      return NextResponse.json({ error: 'Authentication error', details: sessionError.message }, { status: 401 });
    }

    if (!session?.user) {
      console.error('No session found for cart update');
      return NextResponse.json({ error: 'Not authenticated - session not found' }, { status: 401 });
    }

    const user = session.user;

    if (action === 'add' || action === 'update') {
      const { error } = await supabase
        .from('carts')
        .upsert({
          user_id: user.id,
          product_id: productId,
          quantity: quantity
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) {
        console.error('Error updating cart item:', error);
        return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (action === 'remove') {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) {
        console.error('Error removing cart item:', error);
        return NextResponse.json({ error: 'Failed to remove item' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else if (action === 'clear') {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing cart:', error);
        return NextResponse.json({ error: 'Failed to clear cart' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating cart:', error);
    return NextResponse.json({ error: 'Failed to update cart' }, { status: 500 });
  }
}
