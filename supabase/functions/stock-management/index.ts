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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, orderId, orderItems, userId, reason } = await req.json()

    switch (action) {
      case 'updateStockForOrder':
        return await updateStockForOrder(supabaseClient, orderId, orderItems, userId)
      
      case 'revertStockForOrder':
        return await revertStockForOrder(supabaseClient, orderId, userId, reason)
      
      case 'manualStockAdjustment':
        return await manualStockAdjustment(supabaseClient, orderItems, userId, reason)
      
      case 'getStockAlerts':
        return await getStockAlerts(supabaseClient)
      
      case 'markAlertAsRead':
        return await markAlertAsRead(supabaseClient, orderItems.alertId)
      
      default:
        throw new Error('Invalid action')
    }

  } catch (error) {
    console.error('Stock management error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function updateStockForOrder(supabaseClient, orderId, orderItems, userId) {
  const stockUpdates = []
  const stockAdjustments = []
  const alerts = []

  for (const item of orderItems) {
    // Get current product stock
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('stock_quantity, low_stock_threshold, name')
      .eq('id', item.product_id)
      .single()

    if (productError) throw new Error(`Product not found: ${item.product_id}`)

    const previousStock = product.stock_quantity
    const newStock = Math.max(0, previousStock - item.quantity)
    const quantityChange = newStock - previousStock

    // Update product stock
    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', item.product_id)

    if (updateError) throw new Error(`Failed to update stock for product ${item.product_id}`)

    // Log stock adjustment
    stockAdjustments.push({
      product_id: item.product_id,
      order_id: orderId,
      adjustment_type: 'order_placed',
      quantity_change: quantityChange,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: `Order placed - ${item.quantity} units sold`,
      adjusted_by: userId
    })

    // Check for stock alerts
    const threshold = product.low_stock_threshold || 5
    
    if (newStock <= 0) {
      alerts.push({
        product_id: item.product_id,
        alert_type: 'out_of_stock',
        current_stock: newStock,
        threshold: threshold
      })
    } else if (newStock <= threshold && previousStock > threshold) {
      alerts.push({
        product_id: item.product_id,
        alert_type: 'low_stock',
        current_stock: newStock,
        threshold: threshold
      })
    }

    stockUpdates.push({
      product_id: item.product_id,
      product_name: product.name,
      previous_stock: previousStock,
      new_stock: newStock,
      quantity_sold: item.quantity
    })
  }

  // Insert stock adjustments
  if (stockAdjustments.length > 0) {
    const { error: adjustmentError } = await supabaseClient
      .from('stock_adjustments')
      .insert(stockAdjustments)

    if (adjustmentError) throw new Error('Failed to log stock adjustments')
  }

  // Insert stock alerts
  if (alerts.length > 0) {
    const { error: alertError } = await supabaseClient
      .from('stock_alerts')
      .insert(alerts)

    if (alertError) console.error('Failed to create stock alerts:', alertError)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Stock updated successfully',
      stockUpdates,
      alertsCreated: alerts.length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function revertStockForOrder(supabaseClient, orderId, userId, reason) {
  // Get original order items to revert stock
  const { data: orderItems, error: orderError } = await supabaseClient
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId)

  if (orderError) throw new Error('Failed to fetch order items')

  const stockUpdates = []
  const stockAdjustments = []

  for (const item of orderItems) {
    // Get current product stock
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('stock_quantity, name')
      .eq('id', item.product_id)
      .single()

    if (productError) continue // Skip if product not found

    const previousStock = product.stock_quantity
    const newStock = previousStock + item.quantity
    const quantityChange = newStock - previousStock

    // Update product stock
    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', item.product_id)

    if (updateError) throw new Error(`Failed to revert stock for product ${item.product_id}`)

    // Log stock adjustment
    stockAdjustments.push({
      product_id: item.product_id,
      order_id: orderId,
      adjustment_type: reason === 'cancelled' ? 'order_cancelled' : 'order_refunded',
      quantity_change: quantityChange,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: `Order ${reason} - ${item.quantity} units returned to stock`,
      adjusted_by: userId
    })

    stockUpdates.push({
      product_id: item.product_id,
      product_name: product.name,
      previous_stock: previousStock,
      new_stock: newStock,
      quantity_returned: item.quantity
    })
  }

  // Insert stock adjustments
  if (stockAdjustments.length > 0) {
    const { error: adjustmentError } = await supabaseClient
      .from('stock_adjustments')
      .insert(stockAdjustments)

    if (adjustmentError) throw new Error('Failed to log stock adjustments')
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Stock reverted successfully',
      stockUpdates
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function manualStockAdjustment(supabaseClient, adjustments, userId, reason) {
  const stockUpdates = []
  const stockAdjustments = []
  const alerts = []

  for (const adjustment of adjustments) {
    // Get current product stock
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('stock_quantity, low_stock_threshold, name')
      .eq('id', adjustment.product_id)
      .single()

    if (productError) throw new Error(`Product not found: ${adjustment.product_id}`)

    const previousStock = product.stock_quantity
    const newStock = Math.max(0, adjustment.new_stock)
    const quantityChange = newStock - previousStock

    // Update product stock
    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', adjustment.product_id)

    if (updateError) throw new Error(`Failed to update stock for product ${adjustment.product_id}`)

    // Log stock adjustment
    stockAdjustments.push({
      product_id: adjustment.product_id,
      adjustment_type: 'manual_adjustment',
      quantity_change: quantityChange,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: reason || 'Manual stock adjustment',
      adjusted_by: userId
    })

    // Check for stock alerts
    const threshold = product.low_stock_threshold || 5
    
    if (newStock <= 0 && previousStock > 0) {
      alerts.push({
        product_id: adjustment.product_id,
        alert_type: 'out_of_stock',
        current_stock: newStock,
        threshold: threshold
      })
    } else if (newStock <= threshold && previousStock > threshold) {
      alerts.push({
        product_id: adjustment.product_id,
        alert_type: 'low_stock',
        current_stock: newStock,
        threshold: threshold
      })
    }

    stockUpdates.push({
      product_id: adjustment.product_id,
      product_name: product.name,
      previous_stock: previousStock,
      new_stock: newStock,
      quantity_change: quantityChange
    })
  }

  // Insert stock adjustments
  if (stockAdjustments.length > 0) {
    const { error: adjustmentError } = await supabaseClient
      .from('stock_adjustments')
      .insert(stockAdjustments)

    if (adjustmentError) throw new Error('Failed to log stock adjustments')
  }

  // Insert stock alerts
  if (alerts.length > 0) {
    const { error: alertError } = await supabaseClient
      .from('stock_alerts')
      .insert(alerts)

    if (alertError) console.error('Failed to create stock alerts:', alertError)
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Manual stock adjustment completed',
      stockUpdates,
      alertsCreated: alerts.length
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getStockAlerts(supabaseClient) {
  const { data: alerts, error } = await supabaseClient
    .from('stock_alerts')
    .select(`
      *,
      products (
        name,
        sku,
        stock_quantity
      )
    `)
    .eq('is_read', false)
    .order('created_at', { ascending: false })

  if (error) throw new Error('Failed to fetch stock alerts')

  return new Response(
    JSON.stringify({ alerts }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function markAlertAsRead(supabaseClient, alertId) {
  const { error } = await supabaseClient
    .from('stock_alerts')
    .update({ is_read: true })
    .eq('id', alertId)

  if (error) throw new Error('Failed to mark alert as read')

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}