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
    // Create authenticated client using the user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Also create service role client for database updates
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get the user from the request
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not authenticated' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured')
    }

    const { action, orderId, amount, currency = 'cad', customerInfo, paymentIntentId } = await req.json()

    console.log('Stripe payment request:', { action, orderId, amount, currency, userId: user.id })

    const stripeHeaders = {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    switch (action) {
      case 'create_checkout_session':
        // First try to find order using service role to see all orders
        const { data: allOrderData, error: allOrderError } = await supabaseServiceClient
          .from('orders')
          .select('id, order_number, total, customer_id, customer_email')
          .eq('id', orderId)
          .single()

        if (allOrderError || !allOrderData) {
          console.error('Order lookup error (service role):', allOrderError)
          console.log('Searching for order with ID:', orderId)
          
          // Try to find recent orders for this user
          const { data: userOrders, error: userOrdersError } = await supabaseServiceClient
            .from('orders')
            .select('id, order_number, total, customer_id, customer_email, created_at')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5)

          console.log('Recent user orders:', userOrders)
          
          throw new Error(`Order not found: ${orderId}`)
        }

        // Verify the order belongs to the authenticated user
        if (allOrderData.customer_id !== user.id) {
          console.error('Order ownership mismatch:', { 
            orderCustomerId: allOrderData.customer_id, 
            authUserId: user.id 
          })
          throw new Error(`Order access denied: ${orderId}`)
        }

        console.log('Order found and verified:', allOrderData)

        // Create Stripe Checkout Session for redirect
        const sessionParams = new URLSearchParams({
          'payment_method_types[0]': 'card',
          mode: 'payment',
          'line_items[0][price_data][currency]': currency,
          'line_items[0][price_data][product_data][name]': `Groceree Order ${allOrderData.order_number}`,
          'line_items[0][price_data][product_data][description]': 'Fresh grocery delivery',
          'line_items[0][price_data][unit_amount]': Math.round((amount || allOrderData.total) * 100).toString(),
          'line_items[0][quantity]': '1',
          'customer_email': customerInfo?.email || allOrderData.customer_email || user.email || '',
          'metadata[order_id]': orderId.toString(),
          'metadata[order_number]': allOrderData.order_number,
          'metadata[customer_name]': customerInfo ? `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() : '',
          success_url: `${req.headers.get('origin') || 'https://your-domain.com'}/order-success?orderId=${orderId}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${req.headers.get('origin') || 'https://your-domain.com'}/checkout?payment=cancelled&orderId=${orderId}`,
          'billing_address_collection': 'auto',
          'shipping_address_collection[allowed_countries][0]': 'CA',
        })

        const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: stripeHeaders,
          body: sessionParams,
        })

        const session = await sessionResponse.json()

        if (!sessionResponse.ok) {
          console.error('Stripe session creation error:', session)
          throw new Error(session.error?.message || 'Failed to create checkout session')
        }

        console.log('Stripe session created:', session.id)

        // Update order with session ID using service role key for write permissions
        const { error: updateError } = await supabaseServiceClient
          .from('orders')
          .update({ 
            stripe_session_id: session.id,
            payment_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .eq('customer_id', user.id) // Ensure user owns this order

        if (updateError) {
          console.error('Order update error:', updateError)
          // Don't fail the entire request if session was created successfully
          console.warn(`Warning: Could not update order ${orderId} with session ID ${session.id}`)
        } else {
          console.log('Order updated with session ID successfully')
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            checkout_url: session.url,
            session_id: session.id,
            order_id: orderId
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'create_intent':
        // Verify order exists using service role
        const { data: intentOrderData, error: intentOrderError } = await supabaseServiceClient
          .from('orders')
          .select('id, order_number, total, customer_id')
          .eq('id', orderId)
          .single()

        if (intentOrderError || !intentOrderData) {
          console.error('Intent order lookup error:', intentOrderError)
          throw new Error(`Order not found: ${orderId}`)
        }

        // Verify ownership
        if (intentOrderData.customer_id !== user.id) {
          throw new Error(`Order access denied: ${orderId}`)
        }

        // Create payment intent for pre-authorization
        const createParams = new URLSearchParams({
          amount: Math.round((amount || intentOrderData.total) * 100).toString(),
          currency: currency,
          capture_method: 'manual',
          'metadata[order_id]': orderId.toString(),
          'metadata[order_number]': intentOrderData.order_number,
          'metadata[customer_email]': customerInfo?.email || user.email || '',
          'metadata[customer_name]': customerInfo ? `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() : '',
        })

        const createResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
          method: 'POST',
          headers: stripeHeaders,
          body: createParams,
        })

        const paymentIntent = await createResponse.json()

        if (!createResponse.ok) {
          console.error('Payment intent creation error:', paymentIntent)
          throw new Error(paymentIntent.error?.message || 'Failed to create payment intent')
        }

        // Store payment intent ID in order using service role
        const { error: intentUpdateError } = await supabaseServiceClient
          .from('orders')
          .update({ 
            stripe_payment_intent_id: paymentIntent.id,
            payment_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
          .eq('customer_id', user.id)

        if (intentUpdateError) {
          console.error('Payment intent update error:', intentUpdateError)
          console.warn(`Warning: Could not update order ${orderId} with payment intent ${paymentIntent.id}`)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'capture_payment':
        if (!paymentIntentId) {
          throw new Error('Payment intent ID is required for capture')
        }

        // Capture the pre-authorized payment
        const captureParams = new URLSearchParams({
          amount_to_capture: Math.round(amount * 100).toString(),
        })

        const captureResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/capture`, {
          method: 'POST',
          headers: stripeHeaders,
          body: captureParams,
        })

        const capturedIntent = await captureResponse.json()

        if (!captureResponse.ok) {
          console.error('Payment capture error:', capturedIntent)
          throw new Error(capturedIntent.error?.message || 'Failed to capture payment')
        }

        // Update order payment status using service role
        const { error: captureUpdateError } = await supabaseServiceClient
          .from('orders')
          .update({ 
            payment_status: 'paid',
            payment_date: new Date().toISOString(),
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntentId)

        if (captureUpdateError) {
          console.error('Capture update error:', captureUpdateError)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            payment_intent: capturedIntent
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'cancel_intent':
        if (!paymentIntentId) {
          throw new Error('Payment intent ID is required for cancellation')
        }

        // Cancel payment intent
        const cancelResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}/cancel`, {
          method: 'POST',
          headers: stripeHeaders,
        })

        const cancelledIntent = await cancelResponse.json()

        if (!cancelResponse.ok) {
          console.error('Payment cancellation error:', cancelledIntent)
          throw new Error(cancelledIntent.error?.message || 'Failed to cancel payment intent')
        }

        // Update order status using service role
        const { error: cancelUpdateError } = await supabaseServiceClient
          .from('orders')
          .update({ 
            payment_status: 'cancelled',
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntentId)

        if (cancelUpdateError) {
          console.error('Cancel update error:', cancelUpdateError)
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            payment_intent: cancelledIntent
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'refund_payment':
        if (!paymentIntentId) {
          throw new Error('Payment intent ID is required for refund')
        }

        // Create refund
        const refundParams = new URLSearchParams({
          payment_intent: paymentIntentId,
          amount: Math.round(amount * 100).toString(),
        })

        const refundResponse = await fetch('https://api.stripe.com/v1/refunds', {
          method: 'POST',
          headers: stripeHeaders,
          body: refundParams,
        })

        const refund = await refundResponse.json()

        if (!refundResponse.ok) {
          console.error('Refund creation error:', refund)
          throw new Error(refund.error?.message || 'Failed to create refund')
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            refund: refund
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        throw new Error('Invalid action specified')
    }

  } catch (error) {
    console.error('Stripe payment error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'An unexpected error occurred',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})