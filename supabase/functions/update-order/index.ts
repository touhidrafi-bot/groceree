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

    const body = await req.json()
    const { orderId, items, subtotal, gst, pst, total, editedBy, tipAmount, deliveryFee, discount } = body

    // Calculate total tax for the main tax field
    const totalTax = (gst || 0) + (pst || 0)

    // Ensure numeric values
    const subtotalNum = Number(subtotal) || 0
    const gstNum = Number(gst) || 0
    const pstNum = Number(pst) || 0
    const tipNum = Number(tipAmount) || 0
    const deliveryFeeNum = Number(deliveryFee) || 0
    const discountNum = Number(discount) || 0

    // If total not provided, compute it here to ensure consistency
    const computedTotal = typeof total === 'number' ? Number(total) : (subtotalNum + totalTax + deliveryFeeNum - discountNum + tipNum)

    // Update the order totals and tip_amount
    const { error: orderError } = await supabaseClient
      .from('orders')
      .update({
        subtotal: Number(subtotalNum.toFixed(2)),
        tax: Number(totalTax.toFixed(2)),
        gst: Number(gstNum.toFixed(2)),
        pst: Number(pstNum.toFixed(2)),
        tip_amount: Number(tipNum.toFixed(2)),
        delivery_fee: Number(deliveryFeeNum.toFixed(2)),
        discount: Number(discountNum.toFixed(2)),
        total: Number(Number(computedTotal).toFixed(2)),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (orderError) {
      console.error('Order update error:', orderError)
      throw orderError
    }

    // Delete existing order items
    const { error: deleteError } = await supabaseClient
      .from('order_items')
      .delete()
      .eq('order_id', orderId)

    if (deleteError) {
      console.error('Delete items error:', deleteError)
      throw deleteError
    }

    // Insert updated order items
    const orderItems = (items || []).map((item: any) => ({
      order_id: orderId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      bottle_price: item.bottle_price || 0,
      total_price: item.total_price,
      final_weight: item.final_weight || null
    }))

    if (orderItems.length > 0) {
      const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('Insert items error:', itemsError)
        throw itemsError
      }
    }

    // Log the edit in order_edit_history
    const { error: historyError } = await supabaseClient
      .from('order_edit_history')
      .insert({
        order_id: orderId,
        edit_type: 'order_update',
        changes: {
          subtotal: Number(subtotalNum.toFixed(2)),
          gst: Number(gstNum.toFixed(2)),
          pst: Number(pstNum.toFixed(2)),
          total_tax: Number(totalTax.toFixed(2)),
          tip_amount: Number(tipNum.toFixed(2)),
          delivery_fee: Number(deliveryFeeNum.toFixed(2)),
          discount: Number(discountNum.toFixed(2)),
          total: Number(Number(computedTotal).toFixed(2)),
          items_count: (items || []).length,
          updated_items: (items || []).map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            total_price: item.total_price,
            final_weight: item.final_weight
          }))
        },
        edited_by: editedBy || 'admin',
        edited_at: new Date().toISOString()
      })

    if (historyError) {
      console.error('Error logging edit history:', historyError)
      // Don't throw error for history logging failure
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error updating order:', error)
    return new Response(
      JSON.stringify({ 
        error: (error as any)?.message || 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
