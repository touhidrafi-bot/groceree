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
      const bottlePrice = Number(item.bottlePrice) || 0
      const quantity = Number(item.quantity) || 0
      return sum + ((price + bottlePrice) * quantity)
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
      const bottlePrice = Number(item.bottlePrice) || 0
      const quantity = Number(item.quantity) || 1
      const totalPrice = (unitPrice + bottlePrice) * quantity

      return {
        order_id: order.id,
        product_id: item.id,
        quantity: quantity,
        unit_price: unitPrice,
        bottle_price: bottlePrice,
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
