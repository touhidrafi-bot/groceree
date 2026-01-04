import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userDataError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, orderId, itemId, productId, quantity, finalWeight, finalPrice, newItems } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Fetch current order for comparison
    const { data: currentOrder, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, total, subtotal, gst, pst, tax, delivery_fee, tip_amount, discount, order_items(id, product_id, quantity, unit_price, total_price, final_weight, final_price, bottle_price, products(id, name, scalable, tax_type, price, bottle_price))')
      .eq('id', orderId)
      .single();

    if (orderError || !currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const oldTotal = currentOrder.total;
    const oldSubtotal = currentOrder.subtotal;
    const _oldTax = currentOrder.tax;
    const oldItems = currentOrder.order_items || [];

    let editType = action;
    let changes: Record<string, any> = {};
    let updatedOrderItems = [...oldItems];

    if (action === 'update_item') {
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }

      const itemIndex = updatedOrderItems.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      const item = updatedOrderItems[itemIndex];
      const oldQuantity = item.quantity;
      const oldItemTotal = item.total_price;

      let newQuantity = quantity !== undefined ? quantity : item.quantity;
      let newItemTotal = 0;
      let newFinalWeight = finalWeight !== undefined ? finalWeight : item.final_weight;
      let newFinalPrice = finalPrice !== undefined ? finalPrice : item.final_price;

      const product = Array.isArray(item.products) ? item.products[0] : item.products;

      if (product.scalable) {
        // Scalable items: validate decimal quantity
        newQuantity = Math.max(0.01, parseFloat(newQuantity.toFixed(2)));
        newFinalWeight = newQuantity;
        const unitPrice = parseFloat(item.unit_price.toString());
        const bottlePrice = parseFloat((item.bottle_price || 0).toString());
        // Bottle price is a one-time fee, not per unit weight
        newItemTotal = parseFloat(((newQuantity * unitPrice) + bottlePrice).toFixed(2));
        newFinalPrice = newItemTotal;
      } else {
        // Non-scalable items: validate integer quantity
        newQuantity = Math.max(1, Math.round(newQuantity));
        const unitPrice = parseFloat(item.unit_price.toString());
        const bottlePrice = parseFloat((item.bottle_price || 0).toString());
        // Bottle price is a one-time fee, not per unit
        newItemTotal = parseFloat(((newQuantity * unitPrice) + bottlePrice).toFixed(2));
      }

      changes = {
        item_id: itemId,
        product_name: product.name,
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        old_total_price: oldItemTotal,
        new_total_price: newItemTotal,
        ...(newFinalWeight !== undefined && { old_final_weight: item.final_weight, new_final_weight: newFinalWeight }),
        ...(newFinalPrice !== undefined && { old_final_price: item.final_price, new_final_price: newFinalPrice })
      };

      updatedOrderItems[itemIndex] = {
        ...item,
        quantity: newQuantity,
        total_price: newItemTotal,
        final_weight: newFinalWeight,
        final_price: newFinalPrice
      };

      editType = 'UPDATE_ITEM';
    } else if (action === 'add_item') {
      if (!productId || quantity === undefined) {
        return NextResponse.json({ error: 'Product ID and quantity are required' }, { status: 400 });
      }

      // Fetch product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, price, bottle_price, scalable, tax_type, stock_quantity')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      }

      // Check if product already exists in order
      const existingItem = updatedOrderItems.find(item => {
        const prod = Array.isArray(item.products) ? item.products[0] : item.products;
        return prod.id === productId;
      });

      if (existingItem) {
        return NextResponse.json({ error: 'Product already exists in this order. Use update action instead.' }, { status: 400 });
      }

      let newQuantity = quantity;
      let newItemTotal = 0;

      if (product.scalable) {
        newQuantity = Math.max(0.01, parseFloat(newQuantity.toFixed(2)));
      } else {
        newQuantity = Math.max(1, Math.round(newQuantity));
      }

      // Bottle price is a one-time fee, not per unit
      newItemTotal = parseFloat(((newQuantity * product.price) + (product.bottle_price || 0)).toFixed(2));

      const newItem = {
        id: `new_${Date.now()}`,
        product_id: productId,
        quantity: newQuantity,
        unit_price: product.price,
        total_price: newItemTotal,
        final_weight: product.scalable ? newQuantity : null,
        final_price: newItemTotal,
        bottle_price: product.bottle_price || 0,
        products: [product]
      };

      updatedOrderItems.push(newItem);

      changes = {
        product_id: productId,
        product_name: product.name,
        quantity: newQuantity,
        total_price: newItemTotal
      };

      editType = 'ADD_ITEM';
    } else if (action === 'remove_item') {
      if (!itemId) {
        return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
      }

      const itemIndex = updatedOrderItems.findIndex(item => item.id === itemId);
      if (itemIndex === -1) {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      }

      if (updatedOrderItems.length <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last item from an order' }, { status: 400 });
      }

      const removedItem = updatedOrderItems[itemIndex];
      const product = Array.isArray(removedItem.products) ? removedItem.products[0] : removedItem.products;

      changes = {
        item_id: itemId,
        product_name: product.name,
        quantity: removedItem.quantity,
        total_price: removedItem.total_price
      };

      updatedOrderItems.splice(itemIndex, 1);
      editType = 'REMOVE_ITEM';
    } else if (action === 'batch_update') {
      if (!newItems || !Array.isArray(newItems)) {
        return NextResponse.json({ error: 'New items array is required' }, { status: 400 });
      }

      // Refetch product details for all items to ensure we have tax_type
      const enrichedItems = await Promise.all(
        newItems.map(async (item: any) => {
          // If item already has products data, use it
          if (item.products && typeof item.products === 'object') {
            return item;
          }

          // Otherwise, fetch product details
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, tax_type, price, bottle_price, scalable')
            .eq('id', item.product_id)
            .single();

          if (productError || !product) {
            console.error(`Product not found for ID: ${item.product_id}`);
            return item;
          }

          return {
            ...item,
            products: product
          };
        })
      );

      updatedOrderItems = enrichedItems;
      editType = 'BATCH_UPDATE';
      changes = {
        items_count: enrichedItems.length,
        items: enrichedItems.map(item => ({
          product_id: item.product_id || item.products?.id,
          product_name: item.products?.name || 'Unknown',
          quantity: item.quantity,
          total_price: item.total_price
        }))
      };
    }

    // Recalculate taxes
    let newSubtotal = 0;
    let newGst = 0;
    let newPst = 0;

    updatedOrderItems.forEach((item: any) => {
      newSubtotal += parseFloat(item.total_price.toString());
      const product = Array.isArray(item.products) ? item.products[0] : item.products;

      // Safety check: ensure product exists and has tax_type before accessing it
      if (product && product.tax_type) {
        if (product.tax_type === 'gst') {
          newGst += parseFloat(item.total_price.toString()) * 0.05;
        } else if (product.tax_type === 'gst_pst') {
          newGst += parseFloat(item.total_price.toString()) * 0.05;
          newPst += parseFloat(item.total_price.toString()) * 0.07;
        }
      }
    });

    newSubtotal = parseFloat(newSubtotal.toFixed(2));
    newGst = parseFloat(newGst.toFixed(2));
    newPst = parseFloat(newPst.toFixed(2));

    const newTax = parseFloat((newGst + newPst).toFixed(2));
    const deliveryFee = parseFloat((currentOrder.delivery_fee || 0).toString());
    const tipAmount = parseFloat((currentOrder.tip_amount || 0).toString());
    const discount = parseFloat((currentOrder.discount || 0).toString());

    const newTotal = parseFloat((newSubtotal + newTax + deliveryFee + tipAmount - discount).toFixed(2));

    // Calculate stock adjustments for quantity changes
    const stockAdjustments: Array<{
      product_id: string;
      quantity_change: number;
      old_quantity: number;
      new_quantity: number;
    }> = [];

    oldItems.forEach(oldItem => {
      const updatedItem = updatedOrderItems.find(item => item.id === oldItem.id || item.product_id === oldItem.product_id);

      if (!updatedItem) {
        // Item was removed - restore stock
        stockAdjustments.push({
          product_id: oldItem.product_id,
          quantity_change: oldItem.quantity,
          old_quantity: oldItem.quantity,
          new_quantity: 0
        });
      } else if (updatedItem.quantity !== oldItem.quantity) {
        // Item quantity changed - adjust stock
        const quantityDifference = oldItem.quantity - updatedItem.quantity;
        stockAdjustments.push({
          product_id: oldItem.product_id,
          quantity_change: quantityDifference,
          old_quantity: oldItem.quantity,
          new_quantity: updatedItem.quantity
        });
      }
    });

    // Check for new items
    updatedOrderItems.forEach(updatedItem => {
      if (!oldItems.find(item => item.id === updatedItem.id)) {
        // This is a new item
        stockAdjustments.push({
          product_id: updatedItem.product_id,
          quantity_change: -updatedItem.quantity,
          old_quantity: 0,
          new_quantity: updatedItem.quantity
        });
      }
    });

    // Update order items in database
    // First, delete all existing items
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (deleteError) {
      return NextResponse.json({ error: `Failed to update items: ${deleteError.message}` }, { status: 400 });
    }

    // Insert updated items
    if (updatedOrderItems.length > 0) {
      const itemsToInsert = updatedOrderItems.map((item: any) => ({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        bottle_price: item.bottle_price || 0,
        total_price: item.total_price,
        final_weight: item.final_weight || null,
        final_price: item.final_price || null
      }));

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (insertError) {
        return NextResponse.json({ error: `Failed to insert items: ${insertError.message}` }, { status: 400 });
      }
    }

    // Apply stock adjustments
    for (const adjustment of stockAdjustments) {
      try {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', adjustment.product_id)
          .single();

        if (productError || !product) {
          console.error('Product not found for stock adjustment:', adjustment.product_id);
          continue;
        }

        const previousStock = product.stock_quantity ?? 0;
        const newStock = Math.max(0, previousStock + adjustment.quantity_change);

        // Update product stock
        const { error: updateStockError } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', adjustment.product_id);

        if (!updateStockError) {
          // Log stock adjustment
          await supabase
            .from('stock_adjustments')
            .insert({
              product_id: adjustment.product_id,
              adjustment_type: 'order_edited',
              quantity_change: adjustment.quantity_change,
              previous_stock: previousStock,
              new_stock: newStock,
              reason: `Order #${currentOrder.order_number} edited: quantity changed from ${adjustment.old_quantity} to ${adjustment.new_quantity}`,
              adjusted_by: user.id
            });
        }
      } catch (err) {
        console.error('Error applying stock adjustment:', err);
        // Don't fail the request if stock adjustment fails
      }
    }

    // Update order totals
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        subtotal: newSubtotal,
        gst: newGst,
        pst: newPst,
        tax: newTax,
        total: newTotal,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      return NextResponse.json({ error: `Failed to update order: ${updateError.message}` }, { status: 400 });
    }

    // Log to order_edit_history
    const { error: historyError } = await supabase
      .from('order_edit_history')
      .insert({
        order_id: orderId,
        edited_by: user.id,
        edit_type: editType,
        changes: changes,
        old_total: oldTotal,
        new_total: newTotal,
        old_subtotal: oldSubtotal,
        new_subtotal: newSubtotal,
        created_at: new Date().toISOString(),
        edited_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('Failed to log edit history:', historyError);
      // Don't fail the request if history logging fails
    }

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        subtotal: newSubtotal,
        gst: newGst,
        pst: newPst,
        tax: newTax,
        total: newTotal
      },
      editType,
      changes
    });
  } catch (error) {
    console.error('Error updating order items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
