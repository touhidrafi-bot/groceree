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
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { orderId, manualTrigger = false } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get order details with all related data
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        customer:users!orders_customer_id_fkey(first_name, last_name, email, phone),
        order_items(
          id,
          quantity,
          unit_price,
          total_price,
          final_weight,
          products(name, unit, scalable)
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only send payment request for Interac e-Transfer orders
    if (order.payment_method !== 'interac') {
      return new Response(
        JSON.stringify({ error: 'Payment request only available for Interac e-Transfer orders' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const customerName = `${order.customer.first_name} ${order.customer.last_name}`
    const emailSubject = `Groceree Order Payment Request - Order #${order.order_number}`
    const emailBody = generatePaymentRequestEmail(order, customerName)
    const smsMessage = generatePaymentRequestSMS(order)
    const brevoKey = Deno.env.get('BREVO_API_KEY')

    // Send email notification to customer
    const emailResult = await sendBrevoEmail({
      to: order.customer.email,
      subject: emailSubject,
      html: emailBody,
      apiKey: brevoKey
    })

    // Send SMS notification (optional)
    let smsResult = { success: true, smsId: null }
    if (order.customer.phone) {
      smsResult = await sendSMS({
        to: order.customer.phone,
        message: smsMessage
      })
    }

    // Log the payment request notification
    const { error: logError } = await supabaseClient
      .from('order_notifications')
      .insert({
        order_id: orderId,
        notification_type: 'payment_request',
        recipient_email: order.customer.email,
        recipient_phone: order.customer.phone,
        subject: emailSubject,
        content: emailBody,
        sms_content: smsMessage,
        status: emailResult.success ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
        manual_trigger: manualTrigger
      })

    if (logError) {
      console.error('Error logging notification:', logError)
    }

    return new Response(
      JSON.stringify({
        success: emailResult.success,
        message: emailResult.success ? 'Payment request sent successfully' : 'Failed to send payment request',
        emailId: emailResult.messageId,
        smsId: smsResult.smsId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generatePaymentRequestEmail(order: any, customerName: string): string {
  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  let itemsHtml = ''
  order.order_items.forEach((item: any) => {
    const displayQuantity = item.products.scalable && item.final_weight 
      ? item.final_weight 
      : item.quantity

    const weightInfo = item.products.scalable && item.final_weight && item.final_weight !== item.quantity
      ? `<div style="font-size: 12px; color: #f59e0b; margin-top: 4px;">
           Final weight: ${item.final_weight} ${item.products.unit} (originally ${item.quantity} ${item.products.unit})
         </div>`
      : ''

    itemsHtml += `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 500; color: #111827;">${item.products.name}</div>
          <div style="font-size: 14px; color: #6b7280;">
            ${displayQuantity} ${item.products.unit} × $${item.unit_price.toFixed(2)}
          </div>
          ${weightInfo}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
          $${item.total_price.toFixed(2)}
        </td>
      </tr>
    `
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Request - Groceree</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Groceree</h1>
          <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 16px;">Fresh groceries delivered to your door</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 24px; font-weight: 600;">
            Payment Request
          </h2>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Dear ${customerName},
          </p>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Your grocery order has been picked and the final pricing has been confirmed. 
            Please send your Interac e-Transfer payment to complete your order.
          </p>

          <!-- Payment Instructions -->
          <div style="background-color: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px; font-weight: 600;">
              Payment Instructions
            </h3>
            <div style="space-y: 8px;">
              <div style="margin-bottom: 8px;">
                <strong style="color: #1e40af;">Send to:</strong> 
                <span style="color: #111827; font-family: monospace; background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px;">payments@groceree.ca</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="color: #1e40af;">Amount:</strong> 
                <span style="color: #111827; font-size: 18px; font-weight: 600;">$${parseFloat(order.total).toFixed(2)}</span>
              </div>
              <div style="margin-bottom: 8px;">
                <strong style="color: #1e40af;">Message:</strong> 
                <span style="color: #111827; font-family: monospace; background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px;">Order #${order.order_number}</span>
              </div>
            </div>
            <p style="margin: 15px 0 0 0; color: #1e40af; font-size: 14px;">
              ⚠️ Please include your order number in the transfer message for faster processing.
            </p>
          </div>

          <!-- Order Details -->}
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-weight: 500; color: #374151;">Order Number:</span>
              <span style="color: #111827; font-weight: 600;">#${order.order_number}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-weight: 500; color: #374151;">Order Date:</span>
              <span style="color: #111827;">${orderDate}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="font-weight: 500; color: #374151;">Delivery Address:</span>
              <span style="color: #111827; text-align: right; max-width: 300px;">${order.delivery_address}</span>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                  Item Details
                </th>
                <th style="padding: 16px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Total -->
          <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <span style="font-weight: 600; font-size: 20px; color: #111827;">Final Total:</span>
              <span style="font-weight: 600; font-size: 20px; color: #10b981;">$${parseFloat(order.total).toFixed(2)}</span>
            </div>
          </div>

          <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Once we receive your payment, we'll confirm your order and schedule your delivery. 
            You'll receive a confirmation email with your delivery details.
          </p>
          
          <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Thank you for choosing Groceree!
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
            Groceree - Fresh groceries delivered to your door
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            Questions? Reply to this email or contact us at groceree@outlook.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

function generatePaymentRequestSMS(order: any): string {
  return `Groceree: Your order #${order.order_number} is ready! Please send $${parseFloat(order.total).toFixed(2)} via Interac e-Transfer to payments@groceree.ca with your order number in the message. Thank you!`
}

async function sendBrevoEmail(emailData: any) {
  try {
    const { to, subject, html, apiKey } = emailData

    if (!apiKey) {
      console.error('❌ BREVO_API_KEY not configured')
      return {
        success: false,
        messageId: null,
        error: 'Email service not configured'
      }
    }

    if (!to || !to.includes('@')) {
      throw new Error(`Invalid recipient email: ${to}`)
    }

    console.log('📤 Sending email via Brevo to:', to)

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: { email: 'orders@groceree.ca', name: 'Groceree' },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
      }),
    })

    const body = await res.json()

    if (!res.ok) {
      console.error('❌ Brevo API error:', {
        status: res.status,
        error: body
      })
      return {
        success: false,
        messageId: null,
        error: body.message || `HTTP ${res.status}`
      }
    }

    console.log('✅ Email sent successfully')
    return {
      success: true,
      messageId: body.messageId || `email_${Date.now()}`
    }
  } catch (err: any) {
    console.error('❌ Email send failed:', err.message)
    return {
      success: false,
      messageId: null,
      error: err.message
    }
  }
}

async function sendSMS(smsData: any) {
  // Mock SMS sending function
  // In production, integrate with Twilio, AWS SNS, or similar service
  console.log('Sending payment request SMS:', {
    to: smsData.to,
    message: smsData.message
  })
  
  // Simulate SMS sending delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  return {
    success: true,
    smsId: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
