import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    )

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: { user } = {} } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: 'User not authenticated' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 })
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) throw new Error('Stripe secret key not configured')

    const body = await req.json()
    const { action, orderId, amount, currency = 'cad', customerInfo, paymentIntentId } = body

    const stripeHeaders = {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    switch (action) {
      case 'create_checkout_session': {
        // Create a Stripe Checkout Session for redirect-based payment
        const { orderId: oid, amount: amt, currency: cur = 'cad', customerInfo: cust } = body

        // Ensure order exists and belongs to user
        const { data: orderChk, error: orderChkErr } = await supabaseServiceClient
          .from('orders')
          .select('id, order_number, total, customer_id')
          .eq('id', oid)
          .single()

        if (orderChkErr || !orderChk) throw new Error(`Order not found: ${oid}`)
        if (orderChk.customer_id !== user.id) throw new Error('Order access denied')

        const amountCents = Math.round((amt ?? orderChk.total) * 100)

        const params = new URLSearchParams()
        params.append('payment_method_types[]', 'card')
        params.append('mode', 'payment')
        // Use a fallback frontend URL if env not set
        let frontendUrl = Deno.env.get('FRONTEND_URL')
        if (!frontendUrl || !/^https?:\/\//.test(frontendUrl)) {
          frontendUrl = 'https://groceree.ca'; // fallback to production domain
        }
        params.append('success_url', `${frontendUrl}/order-success?orderId=${oid}&session_id={CHECKOUT_SESSION_ID}&payment=success`)
        params.append('cancel_url', `${frontendUrl}/checkout`)
        params.append('metadata[order_id]', String(oid))
        params.append('line_items[0][price_data][currency]', cur)
        params.append('line_items[0][price_data][product_data][name]', `Order ${orderChk.order_number || oid}`)
        params.append('line_items[0][price_data][unit_amount]', String(amountCents))
        params.append('line_items[0][quantity]', '1')

        const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: stripeHeaders, body: params })
        const session = await r.json()
        if (!r.ok) throw new Error(session.error?.message || 'Failed to create checkout session')

        // Persist checkout session id on order for reference
        await supabaseServiceClient.from('orders').update({ stripe_payment_intent_id: session.payment_intent || session.id, updated_at: new Date().toISOString() }).eq('id', oid)

        return new Response(JSON.stringify({ success: true, checkout_url: session.url, session_id: session.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'create_intent': {
        // Ensure order exists and belongs to user
        const { data: order, error: orderErr } = await supabaseServiceClient
          .from('orders')
          .select('id, order_number, total, customer_id')
          .eq('id', orderId)
          .single()

        if (orderErr || !order) throw new Error(`Order not found: ${orderId}`)
        if (order.customer_id !== user.id) throw new Error('Order access denied')

        const params = new URLSearchParams()
        params.append('amount', Math.round((amount ?? order.total) * 100).toString())
        params.append('currency', currency)
        params.append('capture_method', 'manual')
        params.append('metadata[order_id]', String(orderId))
        if (order.order_number) params.append('metadata[order_number]', String(order.order_number))

        const r = await fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers: stripeHeaders, body: params })
        const paymentIntent = await r.json()
        if (!r.ok) throw new Error(paymentIntent.error?.message || 'Failed to create payment intent')

        await supabaseServiceClient
          .from('orders')
          .update({ stripe_payment_intent_id: paymentIntent.id, payment_status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', orderId)

        return new Response(JSON.stringify({ success: true, client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'capture_payment': {
        if (!paymentIntentId) throw new Error('paymentIntentId is required')
        const params = new URLSearchParams()
        if (amount) params.append('amount_to_capture', Math.round(amount * 100).toString())

        const r = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/capture`, { method: 'POST', headers: stripeHeaders, body: params })
        const captured = await r.json()
        if (!r.ok) throw new Error(captured.error?.message || 'Failed to capture')

        await supabaseServiceClient
          .from('orders')
          .update({ payment_status: 'paid', payment_date: new Date().toISOString(), status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', paymentIntentId)

        return new Response(JSON.stringify({ success: true, payment_intent: captured }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'cancel_intent': {
        if (!paymentIntentId) throw new Error('paymentIntentId is required')
        const r = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/cancel`, { method: 'POST', headers: stripeHeaders })
        const cancelled = await r.json()
        if (!r.ok) throw new Error(cancelled.error?.message || 'Failed to cancel')

        await supabaseServiceClient
          .from('orders')
          .update({ payment_status: 'cancelled', status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', paymentIntentId)

        return new Response(JSON.stringify({ success: true, payment_intent: cancelled }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'refund_payment': {
        if (!paymentIntentId) throw new Error('paymentIntentId is required')
        if (!amount) throw new Error('amount is required for partial refund')
        const params = new URLSearchParams()
        params.append('payment_intent', paymentIntentId)
        params.append('amount', Math.round(amount * 100).toString())

        const r = await fetch('https://api.stripe.com/v1/refunds', { method: 'POST', headers: stripeHeaders, body: params })
        const refund = await r.json()
        if (!r.ok) throw new Error(refund.error?.message || 'Failed to refund')

        await supabaseServiceClient
          .from('orders')
          .update({ payment_status: 'refunded', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', paymentIntentId)

        return new Response(JSON.stringify({ success: true, refund }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'invalid_action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (err) {
    console.error('stripe-payment-intent error:', err)
    return new Response(JSON.stringify({ success: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})