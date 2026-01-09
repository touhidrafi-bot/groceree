import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { orderData, cartItems } = await request.json();

    const supabase = await supabaseServer();

    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Call the Supabase Edge Function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        orderData,
        cartItems
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('Order creation failed:', {
        status: response.status,
        error: result.error,
        details: result.details,
        fullError: result.fullError
      });
      return NextResponse.json(result, { status: response.status });
    }

    // Track promo code usage if a promo code was applied
    if (orderData.appliedPromo?.id) {
      const { data: { user } } = await supabase.auth.getUser();
      const discountAmount = orderData.discount || 0;

      // Track promo code usage server-side
      const { error: trackError } = await supabase
        .from('promo_code_usage')
        .insert({
          promo_code_id: orderData.appliedPromo.id,
          user_id: user?.id,
          order_id: result.orderId || result.order?.id,
          discount_amount: discountAmount,
          used_at: new Date().toISOString()
        });

      if (trackError) {
        console.error('Error tracking promo code usage:', trackError);
      } else {
        // Update current_uses count
        const { data: currentPromo } = await supabase
          .from('promo_codes')
          .select('current_uses')
          .eq('id', orderData.appliedPromo.id)
          .single();

        if (currentPromo) {
          await supabase
            .from('promo_codes')
            .update({ current_uses: (currentPromo.current_uses || 0) + 1 })
            .eq('id', orderData.appliedPromo.id);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}