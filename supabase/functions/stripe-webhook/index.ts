import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    
    // In production, verify webhook signature here
    const event = JSON.parse(body)

    console.log('Stripe webhook event:', event.type)

    switch (event.type) {
      case 'payment_intent.authorized':
        const authorizedIntent = event.data.object
        const authorizedOrderId = authorizedIntent.metadata?.order_id

        if (authorizedOrderId) {
          // Update order status to pre_authorized (authorization only, not captured yet)
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'pre_authorized',
              stripe_payment_intent_id: authorizedIntent.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', authorizedOrderId)

          if (error) {
            console.error('Error updating order to pre_authorized:', error)
          } else {
            console.log(`Order ${authorizedOrderId} marked as pre_authorized`)
          }
        }
        break

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object
        const orderId = paymentIntent.metadata?.order_id
        const captureMethod = paymentIntent.capture_method

        if (orderId) {
          // If this is a manual capture (payment_intent with capture_method: manual), status is already 'pre_authorized'
          // When captured, update to 'paid'
          if (captureMethod === 'manual') {
            // This is a captured payment from pre_authorized
            const { error } = await supabaseClient
              .from('orders')
              .update({
                payment_status: 'paid',
                payment_date: new Date().toISOString(),
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', orderId)

            if (error) {
              console.error('Error updating captured order:', error)
            } else {
              console.log(`Order ${orderId} payment captured and marked as paid`)

              // Trigger email notification
              await supabaseClient.functions.invoke('order-email-notifications', {
                body: {
                  orderId: orderId,
                  emailType: 'payment_confirmation',
                  automaticTrigger: true
                }
              })
            }
          } else {
            // This is an automatic capture (standard payment intent)
            const { error } = await supabaseClient
              .from('orders')
              .update({
                payment_status: 'paid',
                payment_date: new Date().toISOString(),
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', orderId)

            if (error) {
              console.error('Error updating order:', error)
            } else {
              console.log(`Order ${orderId} marked as paid`)

              // Trigger email notification
              await supabaseClient.functions.invoke('order-email-notifications', {
                body: {
                  orderId: orderId,
                  emailType: 'payment_confirmation',
                  automaticTrigger: true
                }
              })
            }
          }
        }
        break

      case 'payment_intent.payment_failed':
        const failedIntent = event.data.object
        const failedOrderId = failedIntent.metadata?.order_id

        if (failedOrderId) {
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'failed'
            })
            .eq('id', failedOrderId)

          if (error) {
            console.error('Error updating failed payment:', error)
          }
        }
        break

      case 'checkout.session.completed':
        const session = event.data.object
        const sessionOrderId = session.metadata?.order_id

        if (sessionOrderId && session.metadata?.payment_type === 'additional_payment') {
          // Handle additional payment completion
          const { error } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              payment_date: new Date().toISOString(),
              status: 'confirmed'
            })
            .eq('id', sessionOrderId)

          if (error) {
            console.error('Error updating additional payment:', error)
          } else {
            // Trigger confirmation email
            await supabaseClient.functions.invoke('order-email-notifications', {
              body: {
                orderId: sessionOrderId,
                emailType: 'payment_confirmation',
                automaticTrigger: true
              }
            })
          }
        }
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
