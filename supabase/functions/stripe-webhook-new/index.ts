import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const body = await req.text()

    // In production, verify signature using Stripe webhook secret
    const event = JSON.parse(body)

    console.log('Stripe webhook event:', event.type)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        const orderId = paymentIntent.metadata?.order_id
        const captureMethod = paymentIntent.capture_method

        if (orderId) {
          const updates: any = { payment_status: 'paid', payment_date: new Date().toISOString(), status: 'confirmed', updated_at: new Date().toISOString() }
          await supabaseClient.from('orders').update(updates).eq('id', orderId)

          await supabaseClient.functions.invoke('order-email-notifications', { body: { orderId, emailType: 'customer_invoice', automaticTrigger: true } })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const failedIntent = event.data.object
        const failedOrderId = failedIntent.metadata?.order_id
        if (failedOrderId) await supabaseClient.from('orders').update({ payment_status: 'failed' }).eq('id', failedOrderId)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
