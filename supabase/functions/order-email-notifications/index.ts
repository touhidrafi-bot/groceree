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

    const { orderId, emailType, manualTrigger = false } = await req.json()

    if (!orderId || !emailType) {
      return new Response(
        JSON.stringify({ error: 'Order ID and email type are required' }),
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

    let emailSubject = ''
    let emailBody = ''

    if (emailType === 'payment_confirmation') {
      emailSubject = `Payment Confirmation - Order #${order.order_number} - Groceree`
      emailBody = generatePaymentConfirmationEmail(order)
    } else if (emailType === 'delivery_confirmation') {
      emailSubject = `Delivery Confirmation - Order #${order.order_number} - Groceree`
      emailBody = generateDeliveryConfirmationEmail(order)
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid email type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email using a mock email service (in production, use SendGrid, AWS SES, etc.)
    const emailResult = await sendEmail({
      to: order.customer.email,
      from: 'orders@groceree.com',
      subject: emailSubject,
      html: emailBody
    })

    // Log the email notification
    const { error: logError } = await supabaseClient
      .from('order_notifications')
      .insert({
        order_id: orderId,
        notification_type: emailType,
        recipient_email: order.customer.email,
        subject: emailSubject,
        content: emailBody,
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
        message: emailResult.success ? 'Email sent successfully' : 'Failed to send email',
        emailId: emailResult.emailId 
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

function generatePaymentConfirmationEmail(order: any): string {
  const customerName = `${order.customer.first_name} ${order.customer.last_name}`
  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  let itemsHtml = ''
  let subtotal = 0
  let gst = 0
  let pst = 0

  order.order_items.forEach((item: any) => {
    const itemSubtotal = item.total_price
    subtotal += itemSubtotal

    // Calculate taxes based on product type
    let itemGST = 0
    let itemPST = 0
    
    // Mock tax calculation (in production, get from product tax_type)
    if (item.products.name.toLowerCase().includes('meat') || 
        item.products.name.toLowerCase().includes('bread')) {
      itemGST = itemSubtotal * 0.05
      if (item.products.name.toLowerCase().includes('bread')) {
        itemPST = itemSubtotal * 0.07
      }
    }
    
    gst += itemGST
    pst += itemPST

    const weightInfo = item.products.scalable && item.final_weight && item.final_weight !== item.quantity
      ? `<div style="font-size: 12px; color: #f59e0b; margin-top: 4px;">
           Weight adjusted: ${item.quantity} ${item.products.unit} → ${item.final_weight} ${item.products.unit}
         </div>`
      : ''

    const displayQuantity = item.products.scalable && item.final_weight 
      ? item.final_weight 
      : item.quantity

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
          $${itemSubtotal.toFixed(2)}
        </td>
      </tr>
    `
  })

  const deliveryFee = 5.00
  const total = subtotal + gst + pst + deliveryFee

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Confirmation - Groceree</title>
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
            Payment Confirmation
          </h2>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Dear ${customerName},
          </p>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Thank you for your order! Your payment has been confirmed and your items have been picked and finalized. 
            Here's your detailed invoice:
          </p>

          <!-- Order Details -->
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

          <!-- Totals -->
          <div style="border-top: 2px solid #e5e7eb; padding-top: 20px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #374151;">Subtotal:</span>
              <span style="color: #111827;">$${subtotal.toFixed(2)}</span>
            </div>
            ${gst > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #374151;">GST (5%):</span>
              <span style="color: #111827;">$${gst.toFixed(2)}</span>
            </div>
            ` : ''}
            ${pst > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #374151;">PST (7%):</span>
              <span style="color: #111827;">$${pst.toFixed(2)}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #374151;">Delivery Fee:</span>
              <span style="color: #111827;">$${deliveryFee.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e7eb;">
              <span style="font-weight: 600; font-size: 18px; color: #111827;">Total:</span>
              <span style="font-weight: 600; font-size: 18px; color: #10b981;">$${total.toFixed(2)}</span>
            </div>
          </div>

          <p style="margin: 30px 0 0 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Your order is now being prepared for delivery. You'll receive another confirmation email once your order has been delivered.
          </p>
          
          <p style="margin: 20px 0 0 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Thank you for choosing Groceree for your grocery needs!
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
            Groceree - Fresh groceries delivered to your door
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

function generateDeliveryConfirmationEmail(order: any): string {
  const customerName = `${order.customer.first_name} ${order.customer.last_name}`
  const deliveryDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  let itemsSummary = ''
  order.order_items.forEach((item: any) => {
    const displayQuantity = item.products.scalable && item.final_weight 
      ? item.final_weight 
      : item.quantity

    itemsSummary += `
      <li style="margin-bottom: 8px; color: #374151;">
        ${item.products.name} - ${displayQuantity} ${item.products.unit}
      </li>
    `
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Delivery Confirmation - Groceree</title>
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
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <span style="color: #ffffff; font-size: 36px;">✓</span>
            </div>
            <h2 style="margin: 0 0 10px 0; color: #111827; font-size: 24px; font-weight: 600;">
              Order Delivered Successfully!
            </h2>
            <p style="margin: 0; color: #6b7280; font-size: 16px;">
              Order #${order.order_number}
            </p>
          </div>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Dear ${customerName},
          </p>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Great news! Your grocery order has been successfully delivered on ${deliveryDate}. 
            We hope you enjoy your fresh groceries!
          </p>

          <!-- Order Summary -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: 600;">
              Delivered Items:
            </h3>
            <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
              ${itemsSummary}
            </ul>
          </div>

          <!-- Payment Summary -->
          <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #065f46; font-weight: 500; font-size: 16px;">Final Total Paid:</span>
              <span style="color: #065f46; font-weight: 600; font-size: 18px;">$${parseFloat(order.total).toFixed(2)}</span>
            </div>
            <p style="margin: 10px 0 0 0; color: #047857; font-size: 14px;">
              ✓ Payment confirmed and processed
            </p>
          </div>

          <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            Thank you for choosing Groceree! We appreciate your business and hope you had a great experience with our service.
          </p>
          
          <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.5;">
            We'd love to hear about your experience. If you have a moment, please consider leaving us feedback to help us improve our service.
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
              Shop Again
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
            Groceree - Fresh groceries delivered to your door
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

async function sendEmail(emailData: any) {
  // Mock email sending function
  // In production, integrate with SendGrid, AWS SES, or similar service
  console.log('Sending email:', {
    to: emailData.to,
    from: emailData.from,
    subject: emailData.subject
  })
  
  // Simulate email sending delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  return {
    success: true,
    emailId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}