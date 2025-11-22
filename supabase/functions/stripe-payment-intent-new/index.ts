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

    const { action, orderId, amount, currency = 'cad', customerInfo, paymentIntentId } = await req.json()

    const stripeHeaders = {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    switch (action) {
      case 'create_intent': {
        const { data: intentOrderData, error: intentOrderError } = await supabaseServiceClient
          .from('orders')
          .select('id, order_number, total, customer_id')
          .eq('id', orderId)
          .single()

        if (intentOrderError || !intentOrderData) throw new Error(`Order not found: ${orderId}`)
        if (intentOrderData.customer_id !== user.id) throw new Error(`Order access denied: ${orderId}`)

        const createParams = new URLSearchParams({
          amount: Math.round((amount || intentOrderData.total) * 100).toString(),
          currency,
          capture_method: 'manual',
          'metadata[order_id]': orderId.toString(),
          'metadata[order_number]': intentOrderData.order_number,
        })

        const createResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: stripeHeaders,
          body: createParams,
        })

        const paymentIntent = await createResponse.json()
        if (!createResponse.ok) throw new Error(paymentIntent.error?.message || 'Failed to create payment intent')

        await supabaseServiceClient
          .from('orders')
          .update({ stripe_payment_intent_id: paymentIntent.id, payment_status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', orderId)

        return new Response(JSON.stringify({ success: true, client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'capture_payment': {
        if (!paymentIntentId) throw new Error('Payment intent ID is required for capture')
        const captureParams = new URLSearchParams({ amount_to_capture: Math.round(amount * 100).toString() })
        const captureResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/capture`, { method: 'POST', headers: stripeHeaders, body: captureParams })
        const capturedIntent = await captureResponse.json()
        if (!captureResponse.ok) throw new Error(capturedIntent.error?.message || 'Failed to capture payment')

        await supabaseServiceClient
          .from('orders')
          .update({ payment_status: 'paid', payment_date: new Date().toISOString(), status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', paymentIntentId)

        return new Response(JSON.stringify({ success: true, payment_intent: capturedIntent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }
  } catch (err) {
    console.error('Stripe payment error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message || String(err) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
