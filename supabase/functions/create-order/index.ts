import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

    const requestBody = await req.json()
    console.log('Request body received:', requestBody)

    // Handle both direct orderData and nested structure
    const orderData = requestBody.orderData || requestBody
    const cartItems = requestBody.cartItems || orderData.cartItems || []

    console.log('Order data extracted:', orderData)
    console.log('TIP AMOUNT FROM orderData:', orderData.tipAmount)
    console.log('Cart items extracted:', cartItems)

    // Validate delivery slot structure with safe access and fallbacks
    let deliverySlot = orderData.deliverySlot || {}
    
    // If deliverySlot is missing or incomplete, create a default one
    if (!deliverySlot || typeof deliverySlot !== 'object') {
      deliverySlot = {
        date: new Date().toISOString().split('T')[0],
        timeSlot: '9:00-12:00',
        displayTime: '9:00 AM - 12:00 PM'
      }
    }

    // Safe access to delivery slot properties with fallbacks
    const deliveryDate = deliverySlot.date || 
                        orderData.deliveryDate || 
                        new Date().toISOString().split('T')[0]
    
    const timeSlot = deliverySlot.timeSlot || 
                    deliverySlot.displayTime || 
                    orderData.timeSlot ||
                    '9:00-12:00'
    
    console.log('Delivery slot processed:', { deliveryDate, timeSlot, originalSlot: deliverySlot })

    // Extract customer information with multiple fallbacks
    let customerEmail = ''
    let customerPhone = ''
    let firstName = ''
    let lastName = ''

    // Try to get email from multiple sources
    if (orderData.customerInfo?.email) {
      customerEmail = orderData.customerInfo.email
    } else if (user.email) {
      customerEmail = user.email
    } else if (user.user_metadata?.email) {
      customerEmail = user.user_metadata.email
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email address is required. Please provide a valid email address in your profile or checkout form.' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get customer name and phone with safe access
    if (orderData.customerInfo?.firstName) {
      firstName = orderData.customerInfo.firstName
    } else if (user.user_metadata?.first_name) {
      firstName = user.user_metadata.first_name
    } else if (user.user_metadata?.full_name) {
      firstName = user.user_metadata.full_name.split(' ')[0] || ''
    }

    if (orderData.customerInfo?.lastName) {
      lastName = orderData.customerInfo.lastName
    } else if (user.user_metadata?.last_name) {
      lastName = user.user_metadata.last_name
    } else if (user.user_metadata?.full_name) {
      const nameParts = user.user_metadata.full_name.split(' ')
      lastName = nameParts.slice(1).join(' ') || ''
    }

    if (orderData.customerInfo?.phone) {
      customerPhone = orderData.customerInfo.phone
    } else if (user.user_metadata?.phone) {
      customerPhone = user.user_metadata.phone
    }

    console.log('Customer info extracted:', { customerEmail, firstName, lastName, customerPhone })

    // Validate required fields
    if (!customerEmail) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email address is required' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!cartItems || cartItems.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Cart is empty' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Generate shorter order number that fits in varchar(20)
    const timestamp = Date.now().toString().slice(-8) // Last 8 digits
    const orderNumber = `GR${timestamp}`

    // Format delivery time properly with safe access
    const deliveryDateTime = `${deliveryDate}T${timeSlot.split('-')[0]}:00`

    // Use only valid payment status values that match database constraints
    let paymentStatus: string
    let orderStatus: string
    
    // Common valid payment status values: pending, paid, failed, refunded
    // Common valid order status values: pending, confirmed, processing, shipped, delivered, cancelled
    if (orderData.paymentMethod === 'interac') {
      paymentStatus = 'pending'
      orderStatus = 'pending'
    } else if (orderData.paymentMethod === 'card') {
      paymentStatus = 'pending'
      orderStatus = 'pending'
    } else {
      paymentStatus = 'pending'
      orderStatus = 'pending'
    }

    // Calculate totals with safe number conversion
    const subtotal = cartItems.reduce((sum: number, item: any) => {
      const price = Number(item.price) || 0
      const bottle_price = Number(item.bottle_price) || 0
      const quantity = Number(item.quantity) || 0
      return sum + ((price + bottle_price) * quantity)
    }, 0)
    
    // Calculate taxes based on product tax types
    let gst = 0
    let pst = 0
    
    cartItems.forEach((item: any) => {
      const itemPrice = Number(item.price) || 0
      const itemQuantity = Number(item.quantity) || 0
      const itemTotal = itemPrice * itemQuantity
      
      if (item.taxType === 'taxable') {
        gst += itemTotal * 0.05 // 5% GST
        pst += itemTotal * 0.07 // 7% PST (BC)
      } else if (item.taxType === 'gst_only') {
        gst += itemTotal * 0.05 // 5% GST only
      }
      // 'tax_exempt' items have no tax
    })
    
    const tax = gst + pst
    const deliveryFee = 5.00
    
    // Ensure discount is a valid number
    const discountValue = Number(orderData.discount) || 0
    // Ensure tip is a valid number
    const tipAmount = Number(orderData.tipAmount) || 0

    const total = subtotal + tax + deliveryFee - discountValue + tipAmount

    // Safe access to delivery address
    const deliveryAddress = orderData.deliveryAddress || 
                           orderData.address ||
                           `${orderData.street || ''}${orderData.apartment ? `, ${orderData.apartment}` : ''}, ${orderData.city || ''}, ${orderData.province || ''} ${orderData.postalCode || ''}`.trim()

    // Prepare order data with safe customer information and proper field lengths
    const orderInsertData = {
      customer_id: user.id,
      order_number: orderNumber,
      status: orderStatus,
      subtotal: Number(subtotal.toFixed(2)),
      gst: Number(gst.toFixed(2)),
      pst: Number(pst.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      delivery_fee: Number(deliveryFee.toFixed(2)),
      discount: Number(discountValue.toFixed(2)),
      tip_amount: Number(tipAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
      delivery_address: deliveryAddress.substring(0, 500),
      delivery_instructions: orderData.deliveryInstructions ? orderData.deliveryInstructions.substring(0, 500) : null,
      preferred_delivery_time: deliveryDateTime,
      delivery_date: deliveryDate,
      delivery_time_slot: timeSlot.substring(0, 50),
      payment_method: (orderData.paymentMethod || 'interac').substring(0, 20),
      payment_status: paymentStatus,
      customer_email: customerEmail.substring(0, 100),
      customer_phone: customerPhone.substring(0, 20),
      customer_name: `${firstName} ${lastName}`.trim().substring(0, 100),
      payment_method_details: {
        customerInfo: {
          email: customerEmail,
          firstName: firstName,
          lastName: lastName,
          phone: customerPhone
        }
      }
    }

    console.log('Order insert data:', orderInsertData)
    console.log('TIP AMOUNT IN INSERT DATA:', orderInsertData.tip_amount)

    // Insert order
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert(orderInsertData)
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create order. Please try again.',
          details: `Failed to create order: ${orderError.message}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('Order created successfully:', order)

    // Insert order items with correct column names matching the database schema
    const orderItems = cartItems.map((item: any) => {
      const unitPrice = Number(item.price) || 0
      const bottle_price = Number(item.bottle_price) || 0
      const quantity = Number(item.quantity) || 1
      const totalPrice = (unitPrice + bottle_price) * quantity

      return {
        order_id: order.id,
        product_id: item.id,
        quantity: quantity,
        unit_price: unitPrice,
        total_price: totalPrice
      }
    })

    console.log('Attempting to insert order items:', JSON.stringify(orderItems))

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Order items creation error:', JSON.stringify(itemsError))
      console.error('Order items that failed:', JSON.stringify(orderItems))
      // Try to delete the order if items failed
      await supabaseClient
        .from('orders')
        .delete()
        .eq('id', order.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create order items. Please try again.',
          details: `Failed to create order items: ${itemsError.message}`,
          fullError: itemsError
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('Order items created successfully')

    // Update stock for each product using stock-management function
    const stockUpdateItems = cartItems.map((item: any) => ({
      product_id: item.id,
      quantity: Number(item.quantity) || 0
    }))

    try {
      const stockResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/stock-management`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'updateStockForOrder',
            orderId: order.id,
            orderItems: stockUpdateItems,
            userId: user.id
          })
        }
      )

      const stockResult = await stockResponse.json()
      if (stockResult.error) {
        console.error('Stock update error:', stockResult.error)
      } else {
        console.log('Stock updated successfully via stock-management function')
      }
    } catch (error) {
      console.error('Error calling stock-management function:', error)
    }

    // Clear user's cart after successful order
    try {
      await supabaseClient
        .from('carts')
        .delete()
        .eq('user_id', user.id)
      console.log('Cart cleared successfully')
    } catch (error) {
      console.error('Error clearing cart:', error)
    }

    // Send admin notification email with full order details
    try {
      console.log('📧 Attempting to send admin notification for order:', order.id)
      const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')

      if (!BREVO_API_KEY) {
        console.warn('⚠️ Cannot send admin email: BREVO_API_KEY not configured')
      } else {
        // Fetch full order details with items for email
        const { data: fullOrder } = await supabaseClient
          .from('orders')
          .select(`
            *,
            order_items(
              quantity,
              unit_price,
              total_price,
              products(name, unit)
            )
          `)
          .eq('id', order.id)
          .single()

        if (fullOrder) {
          const adminEmailHtml = generateAdminOrderNotification(fullOrder, firstName, lastName)
          const adminEmailResult = await sendBrevoEmail({
            to: 'touhid.rafi@gmail.com',
            subject: `🛒 New Order Created - Order #${order.order_number}`,
            html: adminEmailHtml,
            apiKey: BREVO_API_KEY
          })

          if (adminEmailResult.success) {
            console.log('✅ Admin notification email sent successfully')
          } else {
            console.warn('⚠️ Admin notification email failed:', adminEmailResult)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error sending admin notification email:', error)
      // Don't fail the order creation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: order,
        orderId: order.id,
        orderNumber: order.order_number,
        total: order.total,
        message: 'Order created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
        details: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Helper function to generate admin order notification email
function generateAdminOrderNotification(order: any, firstName: string, lastName: string): string {
  const itemsHtml = (order.order_items || []).map((item: any) => {
    const productName = item.products?.name || 'Unknown Product'
    const unit = item.products?.unit || 'unit'
    const quantity = item.quantity || 0
    const unitPrice = Number(item.unit_price || 0).toFixed(2)
    const totalPrice = Number(item.total_price || 0).toFixed(2)

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${productName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${quantity} ${unit}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${unitPrice}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">$${totalPrice}</td>
      </tr>
    `
  }).join('')

  const subtotal = Number(order.subtotal || 0).toFixed(2)
  const tax = Number(order.tax || 0).toFixed(2)
  const deliveryFee = Number(order.delivery_fee || 0).toFixed(2)
  const discount = Number(order.discount || 0).toFixed(2)
  const tipAmount = Number(order.tip_amount || 0).toFixed(2)
  const total = Number(order.total || 0).toFixed(2)

  const paymentMethodDisplay = order.payment_method === 'interac' ? 'Interac e-Transfer' : 'Credit Card'
  const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Order Notification - Groceree</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb;">
      <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">🛒 NEW ORDER ALERT</h1>
          <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 16px;">Order #${order.order_number}</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="margin: 0 0 30px 0; color: #111827; font-size: 24px; font-weight: 600;">
            Order Details
          </h2>

          <!-- Customer Info -->
          <div style="background-color: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #15803d; font-size: 18px; font-weight: 600;">
              Customer Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151; width: 150px;">Name:</td>
                <td style="padding: 8px 0; color: #111827;">${firstName} ${lastName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Email:</td>
                <td style="padding: 8px 0; color: #111827;">${order.customer_email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Phone:</td>
                <td style="padding: 8px 0; color: #111827;">${order.customer_phone || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Order Date:</td>
                <td style="padding: 8px 0; color: #111827;">${orderDate}</td>
              </tr>
            </table>
          </div>

          <!-- Delivery Info -->
          <div style="background-color: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px; font-weight: 600;">
              Delivery Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151; width: 150px;">Address:</td>
                <td style="padding: 8px 0; color: #111827;">${order.delivery_address || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Delivery Date:</td>
                <td style="padding: 8px 0; color: #111827;">${order.delivery_date || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Time Slot:</td>
                <td style="padding: 8px 0; color: #111827;">${order.delivery_time_slot || 'N/A'}</td>
              </tr>
              ${order.delivery_instructions ? `
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Instructions:</td>
                <td style="padding: 8px 0; color: #111827;">${order.delivery_instructions}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Order Items -->
          <h3 style="margin: 0 0 15px 0; color: #111827; font-size: 18px; font-weight: 600;">
            Order Items
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                  Product
                </th>
                <th style="padding: 16px; text-align: center; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                  Qty
                </th>
                <th style="padding: 16px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                  Unit Price
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
            <div style="display: flex; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151; font-weight: 500;">Subtotal:</span>
              <span style="color: #111827; font-weight: 600;">$${subtotal}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151; font-weight: 500;">Tax:</span>
              <span style="color: #111827; font-weight: 600;">$${tax}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151; font-weight: 500;">Delivery Fee:</span>
              <span style="color: #111827; font-weight: 600;">$${deliveryFee}</span>
            </div>
            ${discount !== '0.00' ? `
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151; font-weight: 500;">Discount:</span>
              <span style="color: #10b981; font-weight: 600;">-$${discount}</span>
            </div>
            ` : ''}
            ${tipAmount !== '0.00' ? `
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="color: #374151; font-weight: 500;">Tip:</span>
              <span style="color: #111827; font-weight: 600;">$${tipAmount}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding-top: 12px; margin-top: 12px; border-top: 2px solid #e5e7eb;">
              <span style="color: #111827; font-weight: 600; font-size: 18px;">Total:</span>
              <span style="color: #10b981; font-weight: 600; font-size: 18px;">$${total}</span>
            </div>
          </div>

          <!-- Payment Info -->
          <div style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px; font-weight: 600;">
              Payment Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151; width: 150px;">Payment Method:</td>
                <td style="padding: 8px 0; color: #111827;">${paymentMethodDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 500; color: #374151;">Payment Status:</td>
                <td style="padding: 8px 0;">
                  <span style="display: inline-block; background-color: #fcd34d; color: #92400e; padding: 4px 12px; border-radius: 4px; font-weight: 500;">
                    ${order.payment_status || 'pending'}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
            Log in to your admin dashboard to manage this order.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
            Groceree Admin Notification
          </p>
          <p style="margin: 0; color: #9ca3af; font-size: 12px;">
            This is an automated notification. Do not reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}

// Helper function to send email via Brevo
async function sendBrevoEmail(emailData: any) {
  try {
    const { to, subject, html, apiKey } = emailData

    // Validate inputs
    if (!to || !to.includes('@')) {
      throw new Error(`Invalid recipient email: ${to}`)
    }

    if (!subject || !subject.trim()) {
      throw new Error('Email subject is required')
    }

    if (!html || !html.trim()) {
      throw new Error('Email content (HTML) is required')
    }

    console.log('📤 Sending email via Brevo to:', to)

    const requestBody = {
      sender: { email: 'orders@groceree.ca', name: 'Groceree' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    })

    let responseBody: any = {}
    try {
      responseBody = await response.json()
    } catch (e) {
      console.error('❌ Failed to parse Brevo response as JSON')
      throw new Error(`Brevo API returned ${response.status}: ${response.statusText}`)
    }

    if (!response.ok) {
      console.error('❌ Brevo API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseBody
      })
      const errorMsg = responseBody.message || responseBody.error || `HTTP ${response.status}: ${response.statusText}`
      throw new Error(`Brevo API error: ${errorMsg}`)
    }

    console.log('✅ Email sent successfully to:', to)
    return {
      success: true,
      messageId: responseBody.messageId || `email_${Date.now()}`
    }
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('❌ Email send failed:', errorMsg)
    return {
      success: false,
      error: errorMsg
    }
  }
}
