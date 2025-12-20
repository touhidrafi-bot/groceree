'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/auth';

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  payment_date?: string;
  stripe_payment_intent_id?: string;
  total: number | string;
  subtotal: number;
  gst: number;
  pst: number;
  tax: number;
  delivery_fee: number;
  discount?: number;
  tip_amount?: number;
  created_at: string;
  delivery_address: string;
  delivery_instructions?: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    final_weight?: number;
    bottle_price?: number;
    products: {
      id: string;
      name: string;
      unit: string;
      scalable: boolean;
      tax_type: string;
      stock_quantity: number;
      bottle_price?: number;
    };
  }[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  bottle_price?: number;
  unit: string;
  scalable: boolean;
  tax_type: string;
  stock_quantity: number;
  category: string;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sendingEmail, setSendingEmail] = useState<{[key: string]: boolean}>({});
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState<{[key: string]: boolean}>({});
  const [processingPayment, setProcessingPayment] = useState<{[key: string]: boolean}>({});
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingItems, setEditingItems] = useState<{[key: string]: string}>({});
  const [updatingItems, setUpdatingItems] = useState<{[key: string]: boolean}>({});
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});

  const handleImageError = (imageKey: string) => {
    setImageErrors(prev => ({ ...prev, [imageKey]: true }));
  };

  useEffect(() => {
    loadOrders();
    loadDrivers();
    loadProducts();
  }, []);

  const loadOrders = async () => {
  const baseSelect = `
    id,
    order_number,
    status,
    payment_method,
    payment_status,
    payment_date,
    stripe_payment_intent_id,
    total,
    subtotal,
    gst,
    pst,
    tax,
    delivery_fee,
    discount,
    tip_amount,
    created_at,
    delivery_address,
    delivery_instructions,
    customer:users!orders_customer_id_fkey(first_name, last_name, email, phone),
    driver:users!orders_driver_id_fkey(first_name, last_name),
    order_items(
      id,
      quantity,
      unit_price,
      total_price,
      final_weight,
      bottle_price,
      products(
        id,
        name,
        unit,
        scalable,
        tax_type,
        stock_quantity,
        bottle_price
      )
    )
  `;

  try {
    setLoading(true);

    const { data, error } = await supabase
      .from('orders')
      .select(baseSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error loading admin orders:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      setOrders([]);
      return;
    }

    const formattedOrders: Order[] = (data ?? []).map((order: any) => ({
      ...order,

      customer: Array.isArray(order.customer)
        ? order.customer[0] ?? null
        : order.customer ?? null,

      driver: Array.isArray(order.driver)
        ? order.driver[0] ?? null
        : order.driver ?? null,

      order_items: (order.order_items ?? []).map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        final_weight: item.final_weight,
        bottle_price: item.bottle_price ?? 0,

        // ✅ NORMALIZED ONCE, ALWAYS OBJECT OR NULL
        products: Array.isArray(item.products)
          ? item.products[0] ?? null
          : item.products ?? null,
      })),
    }));

    setOrders(formattedOrders);
  } catch (err) {
    console.error('Unexpected error loading admin orders:', err);
    setOrders([]);
  } finally {
    setLoading(false);
  }
};


  const loadDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('role', 'driver')
        .eq('is_active', true);

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, bottle_price, unit, scalable, tax_type, stock_quantity, category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const calculateTaxes = (items: any[]) => {
  let subtotal = 0;
  let totalGST = 0;
  let totalPST = 0;

  items.forEach(item => {
    const itemTotal = Number(item.total_price ?? 0);
    subtotal += itemTotal;

    // Supabase join → products is ARRAY or null
    const taxType = item.products?.[0]?.tax_type ?? 'none';

    if (taxType === 'gst') {
      totalGST += itemTotal * 0.05;
    } else if (taxType === 'gst_pst') {
      totalGST += itemTotal * 0.05;
      totalPST += itemTotal * 0.07;
    }
  });

  const totalTax = totalGST + totalPST;
  const total = subtotal + totalTax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(totalGST * 100) / 100,
    pst: Math.round(totalPST * 100) / 100,
    tax: Math.round(totalTax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
};

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      if (currentOrder.status === status) {
        return;
      }

      // If order is being cancelled, revert stock for all items
if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!userError && user) {
    // Revert stock for each order item
    for (const orderItem of currentOrder.order_items) {
      const quantity = Number(orderItem.quantity ?? 0);

      // ✅ FIX: products is array or null
      if (!orderItem.products?.id) {
  console.warn('Skipping stock revert, product missing:', orderItem.id);
  continue;
}
const productId = orderItem.products.id;
      // Get current product stock
      const { data: productRow, error: productError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single();

      if (productError || !productRow) {
        console.warn('Product not found for stock revert:', productId);
        continue;
      }

      const previousStock = Number(productRow.stock_quantity ?? 0);
      const newStock = previousStock + quantity;

      // Update product stock
      await supabase
        .from('products')
        .update({ stock_quantity: newStock })
        .eq('id', productId);

      // Log stock adjustment
      await supabase
        .from('stock_adjustments')
        .insert({
          product_id: productId,
          adjustment_type: 'order_cancelled',
          quantity_change: quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: `Order ${currentOrder.order_number} cancelled – ${quantity} units returned`,
          adjusted_by: user.id,
        });
    }
  }
}


      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      await loadOrders();
      await loadProducts();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const updatePaymentStatus = async (orderId: string, paymentStatus: string) => {
    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      if (currentOrder.payment_status === paymentStatus) {
        return;
      }

      const updateData: any = { payment_status: paymentStatus };
      
      if (paymentStatus === 'paid') {
        updateData.payment_date = new Date().toISOString();
        // When payment is marked as paid, advance order status to picked_up
        updateData.status = 'picked_up';
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      await loadOrders();
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    try {
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        throw new Error('Order not found');
      }

      if (currentOrder.driver?.id === driverId) {
        return;
      }

      const { error } = await supabase
        .from('orders')
        .update({ driver_id: driverId })
        .eq('id', orderId);

      if (error) throw error;
      
      await loadOrders();
    } catch (error) {
      console.error('Error assigning driver:', error);
    }
  };

  const updateItemQuantity = async (orderItemId: string, newQuantity: number, orderId: string) => {
    setUpdatingItems(prev => ({ ...prev, [orderItemId]: true }));

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const orderItem = order.order_items.find(item => item.id === orderItemId);
      if (!orderItem) {
        throw new Error('Order item not found');
      }

      let finalQuantity = newQuantity;
      let newTotalPrice = 0;

      if (orderItem.products?.scalable) {
        finalQuantity = Math.max(0.01, parseFloat(newQuantity.toFixed(2)));
        newTotalPrice = finalQuantity * (orderItem.unit_price + (orderItem.bottle_price || 0));
      } else {
        finalQuantity = Math.max(1, Math.round(newQuantity));
        newTotalPrice = finalQuantity * (orderItem.unit_price + (orderItem.bottle_price || 0));
      }

      const updateData: any = {
        quantity: finalQuantity,
        total_price: newTotalPrice
      };

      if (orderItem.products?.scalable) {
        updateData.final_weight = finalQuantity;
      }

      const { error: itemError } = await supabase
        .from('order_items')
        .update(updateData)
        .eq('id', orderItemId);

      if (itemError) {
        throw new Error(`Failed to update item ${orderItem.products?.name}: ${itemError.message}`);
      }

      // Calculate quantity difference for stock adjustment
      const quantityDifference = finalQuantity - orderItem.quantity;

      // Adjust stock based on quantity change
      if (quantityDifference !== 0) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          const stockAdjustmentQuantity = -quantityDifference; // Negative if quantity increased

          await supabase
            .from('stock_adjustments')
            .insert({
              product_id: orderItem.products.id,
              adjustment_type: 'order_edited',
              quantity_change: stockAdjustmentQuantity,
              previous_stock: orderItem.products.stock_quantity,
              new_stock: Math.max(0, orderItem.products.stock_quantity - quantityDifference),
              reason: `Order ${order.order_number} item quantity updated from ${orderItem.quantity} to ${finalQuantity}`,
              adjusted_by: user.id
            });

          // Update product stock
          const newProductStock = Math.max(0, orderItem.products.stock_quantity - quantityDifference);
          await supabase
            .from('products')
            .update({ stock_quantity: newProductStock })
            .eq('id', orderItem.products.id);
        }
      }

      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          const updatedOrderItems = o.order_items.map(item => {
            if (item.id === orderItemId) {
              return {
                ...item,
                quantity: finalQuantity,
                total_price: newTotalPrice,
                final_weight: orderItem.products.scalable ? finalQuantity : item.final_weight
              };
            }
            return item;
          });

          const taxes = calculateTaxes(updatedOrderItems);
          const newTotal = taxes.subtotal + taxes.tax + (o.delivery_fee || 0) + (o.tip_amount || 0) - (o.discount || 0);

          return {
            ...o,
            order_items: updatedOrderItems,
            subtotal: taxes.subtotal,
            gst: taxes.gst,
            pst: taxes.pst,
            tax: taxes.tax,
            total: newTotal
          };
        }
        return o;
      });

      setOrders(updatedOrders);

      if (selectedOrder?.id === orderId) {
        const updatedOrder = updatedOrders.find(o => o.id === orderId);
        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }

      const updatedOrder = updatedOrders.find(o => o.id === orderId);
      if (updatedOrder) {
        const newTotal = updatedOrder.subtotal + updatedOrder.tax + (updatedOrder.delivery_fee || 0) + (updatedOrder.tip_amount || 0) - (updatedOrder.discount || 0);
        const orderUpdateData = {
          subtotal: updatedOrder.subtotal,
          gst: updatedOrder.gst || 0,
          pst: updatedOrder.pst || 0,
          tax: updatedOrder.tax,
          delivery_fee: updatedOrder.delivery_fee || 0,
          discount: updatedOrder.discount || 0,
          tip_amount: updatedOrder.tip_amount || 0,
          total: newTotal,
          updated_at: new Date().toISOString()
        };

        const { error: orderError } = await supabase
          .from('orders')
          .update(orderUpdateData)
          .eq('id', orderId);

        if (orderError) {
          throw new Error(`Failed to update order totals: ${orderError.message}`);
        }
      }

      await loadProducts();

    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity: ' + (error instanceof Error ? error.message : 'Unknown error'));

      await loadOrders();
    } finally {
      setUpdatingItems(prev => ({ ...prev, [orderItemId]: false }));
    }
  };

  const addProductToOrder = async (productId: string, quantity: number, orderId: string) => {
    setAddingProduct(true);
    
    try {
      const product = products.find(p => p.id === productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const order = orders.find(o => o.id === orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      if (product.stock_quantity < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock_quantity} ${product.unit}`);
      }

      const existingItem = order.order_items.find(item => item.products.id === productId);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        await updateItemQuantity(existingItem.id, newQuantity, orderId);
      } else {
        let finalQuantity = quantity;
        if (product.scalable) {
          finalQuantity = Math.max(0.01, parseFloat(quantity.toFixed(2)));
        } else {
          finalQuantity = Math.max(1, Math.round(quantity));
        }

        const totalPrice = finalQuantity * (product.price + (product.bottle_price || 0));

        const insertData = {
          order_id: orderId,
          product_id: productId,
          quantity: finalQuantity,
          unit_price: product.price,
          bottle_price: product.bottle_price || 0,
          total_price: totalPrice,
          final_weight: product.scalable ? finalQuantity : null
        };

        const { data: insertedItemData, error: insertError } = await supabase
          .from('order_items')
          .insert(insertData)
          .select(`
            id,
            quantity,
            unit_price,
            total_price,
            final_weight,
            products(id, name, unit, scalable, tax_type, stock_quantity)
          `)
          .single();

        if (insertError) {
          throw new Error(`Failed to add item ${product.name}: ${insertError.message}`);
        }

        const insertedItem: Order['order_items'][0] = {
          id: insertedItemData.id,
          quantity: insertedItemData.quantity,
          unit_price: insertedItemData.unit_price,
          total_price: insertedItemData.total_price,
          final_weight: insertedItemData.final_weight,
          products: Array.isArray(insertedItemData.products)
            ? insertedItemData.products[0]
            : insertedItemData.products
        };

        const updatedOrders = orders.map(o => {
          if (o.id === orderId) {
            const updatedItems = [...o.order_items, insertedItem];
            const taxes = calculateTaxes(updatedItems);
            const newTotal = taxes.subtotal + taxes.tax + (o.delivery_fee || 0) + (o.tip_amount || 0) - (o.discount || 0);

            return {
              ...o,
              order_items: updatedItems,
              subtotal: taxes.subtotal,
              gst: taxes.gst,
              pst: taxes.pst,
              tax: taxes.tax,
              total: newTotal
            };
          }
          return o;
        });

        setOrders(updatedOrders);

        if (selectedOrder?.id === orderId) {
          const updatedOrder = updatedOrders.find(o => o.id === orderId);
          if (updatedOrder) {
            setSelectedOrder(updatedOrder);
          }
        }

        const updatedOrder = updatedOrders.find(o => o.id === orderId);
        if (updatedOrder) {
          const newTotal = updatedOrder.subtotal + updatedOrder.tax + (updatedOrder.delivery_fee || 0) + (updatedOrder.tip_amount || 0) - (updatedOrder.discount || 0);
          const orderUpdateData = {
            subtotal: updatedOrder.subtotal,
            gst: updatedOrder.gst || 0,
            pst: updatedOrder.pst || 0,
            tax: updatedOrder.tax,
            delivery_fee: updatedOrder.delivery_fee || 0,
            discount: updatedOrder.discount || 0,
            tip_amount: updatedOrder.tip_amount || 0,
            total: newTotal,
            updated_at: new Date().toISOString()
          };

          const { error: orderError } = await supabase
            .from('orders')
            .update(orderUpdateData)
            .eq('id', orderId);

          if (orderError) {
            throw new Error(`Failed to update order totals: ${orderError.message}`);
          }
        }

        const previousStock = product.stock_quantity;
        const newStock = Math.max(0, previousStock - finalQuantity);
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', productId);

        if (stockError) {
          console.error('Error updating product stock:', stockError);
        } else {
          // Log stock adjustment
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (!userError && user) {
            await supabase
              .from('stock_adjustments')
              .insert({
                product_id: productId,
                adjustment_type: 'order_item_added',
                quantity_change: -finalQuantity,
                previous_stock: previousStock,
                new_stock: newStock,
                reason: `Product added to order ${order.order_number} - ${finalQuantity} units deducted`,
                adjusted_by: user.id
              });
          }
        }

        await loadProducts();
      }

      setShowAddProduct(false);
      setProductSearch('');

    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setAddingProduct(false);
    }
  };

  const removeOrderItem = async (orderItemId: string, orderId: string) => {
    if (!confirm('Are you sure you want to remove this item from the order?')) {
      return;
    }

    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      const orderItem = order.order_items.find(item => item.id === orderItemId);
      if (!orderItem) {
        throw new Error('Order item not found');
      }

      if (order.order_items.length <= 1) {
        alert('Cannot remove the last item from an order. Consider cancelling the order instead.');
        return;
      }

      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('id', orderItemId);

      if (deleteError) {
        throw new Error(`Failed to remove item: ${deleteError.message}`);
      }

      const updatedOrders = orders.map(o => {
        if (o.id === orderId) {
          const remainingItems = o.order_items.filter(item => item.id !== orderItemId);
          const taxes = calculateTaxes(remainingItems);
          const newTotal = taxes.subtotal + taxes.tax + (o.delivery_fee || 0) + (o.tip_amount || 0) - (o.discount || 0);

          return {
            ...o,
            order_items: remainingItems,
            subtotal: taxes.subtotal,
            gst: taxes.gst,
            pst: taxes.pst,
            tax: taxes.tax,
            total: newTotal
          };
        }
        return o;
      });

      setOrders(updatedOrders);

      if (selectedOrder?.id === orderId) {
        const updatedOrder = updatedOrders.find(o => o.id === orderId);
        if (updatedOrder) {
          setSelectedOrder(updatedOrder);
        }
      }

      const updatedOrder = updatedOrders.find(o => o.id === orderId);
      if (updatedOrder) {
        const newTotal = updatedOrder.subtotal + updatedOrder.tax + (updatedOrder.delivery_fee || 0) + (updatedOrder.tip_amount || 0) - (updatedOrder.discount || 0);
        const orderUpdateData = {
          subtotal: updatedOrder.subtotal,
          gst: updatedOrder.gst || 0,
          pst: updatedOrder.pst || 0,
          tax: updatedOrder.tax,
          delivery_fee: updatedOrder.delivery_fee || 0,
          discount: updatedOrder.discount || 0,
          tip_amount: updatedOrder.tip_amount || 0,
          total: newTotal,
          updated_at: new Date().toISOString()
        };

        const { error: orderError } = await supabase
          .from('orders')
          .update(orderUpdateData)
          .eq('id', orderId);

        if (orderError) {
          console.error('Error updating order totals after removal:', orderError);
        }
      }

      if (orderItem.products?.id) {
        const product = products.find(p => p.id === orderItem.products.id);
        if (product) {
          const { data: { user }, error: _userError } = await supabase.auth.getUser();
          const previousStock = product.stock_quantity;
          const restoredStock = previousStock + orderItem.quantity;

          const { error: stockError } = await supabase
            .from('products')
            .update({ stock_quantity: restoredStock })
            .eq('id', orderItem.products.id);

          if (stockError) {
            console.error('Error restoring product stock:', stockError);
          } else if (user) {
            // Log stock adjustment for removed item
            await supabase
              .from('stock_adjustments')
              .insert({
                product_id: orderItem.products.id,
                adjustment_type: 'order_item_removed',
                quantity_change: orderItem.quantity,
                previous_stock: previousStock,
                new_stock: restoredStock,
                reason: `Item removed from order ${selectedOrder?.order_number} - ${orderItem.quantity} units restored to stock`,
                adjusted_by: user.id
              });
          }
        }
      }

      await loadProducts();

    } catch (error) {
      console.error('Error removing item:', error);
      alert('Failed to remove item: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleQuantityIncrement = (orderItemId: string, orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const orderItem = order.order_items.find(item => item.id === orderItemId);
    if (!orderItem) return;

    const step = orderItem.products.scalable ? 0.01 : 1;
    const newQuantity = orderItem.quantity + step;
    
    updateItemQuantity(orderItemId, newQuantity, orderId);
  };

  const handleQuantityDecrement = (orderItemId: string, orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const orderItem = order.order_items.find(item => item.id === orderItemId);
    if (!orderItem) return;

    const step = orderItem.products.scalable ? 0.01 : 1;
    const newQuantity = Math.max(orderItem.products.scalable ? 0.01 : 1, orderItem.quantity - step);
    
    updateItemQuantity(orderItemId, newQuantity, orderId);
  };

  const _handleQuantityChange = (orderItemId: string, value: string, orderId: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateItemQuantity(orderItemId, numValue, orderId);
    }
  };

  const handleQuantityEdit = (orderItemId: string, value: string) => {
    setEditingItems(prev => ({ ...prev, [orderItemId]: value }));
  };

  const handleQuantitySave = (orderItemId: string, orderId: string) => {
    const value = editingItems[orderItemId];
    const newQuantity = parseFloat(value);
    
    if (isNaN(newQuantity) || newQuantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    updateItemQuantity(orderItemId, newQuantity, orderId);
  };

  const handleQuantityCancel = (orderItemId: string) => {
    setEditingItems(prev => {
      const newState = { ...prev };
      delete newState[orderItemId];
      return newState;
    });
  };

  const processStripePayment = async (orderId: string, finalAmount: number) => {
    setProcessingPayment(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order?.stripe_payment_intent_id) {
        throw new Error('No payment intent found');
      }

      const originalAmount = parseFloat(order.total.toString());
      
      if (finalAmount <= originalAmount * 1.1) {
        const { data, error } = await supabase.functions.invoke('stripe-payment-intent', {
          body: {
            action: 'capture_payment',
            orderId,
            amount: finalAmount,
            paymentIntentId: order.stripe_payment_intent_id
          }
        });

        if (error) throw error;

        if (data.success) {
          alert('Payment captured successfully!');
          await loadOrders();
        } else {
          throw new Error(data.error || 'Failed to capture payment');
        }
      } else {
        const additionalAmount = finalAmount - originalAmount;
        
        const { data, error } = await supabase.functions.invoke('stripe-payment-intent', {
          body: {
            action: 'create_payment_link',
            orderId,
            amount: additionalAmount
          }
        });

        if (error) throw error;

        if (data.success) {
          alert(`Additional payment required. Payment link: ${data.payment_link}`);
        } else {
          throw new Error(data.error || 'Failed to create payment link');
        }
      }
    } catch (error) {
      console.error('Error processing Stripe payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Payment processing failed: ${errorMessage}`);
    } finally {
      setProcessingPayment(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleManualPaymentCapture = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    await processStripePayment(orderId, parseFloat(order.total.toString()));
  };

  const handlePaymentRefund = async (orderId: string, amount?: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order?.stripe_payment_intent_id) return;

    const refundAmount = amount || parseFloat(order.total.toString());
    
    setProcessingPayment(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment-intent', {
        body: {
          action: 'refund_payment',
          orderId,
          amount: refundAmount,
          paymentIntentId: order.stripe_payment_intent_id
        }
      });

      if (error) throw error;

      if (data.success) {
        alert(`Refund of $${refundAmount.toFixed(2)} processed successfully!`);
        await loadOrders();
      } else {
        throw new Error(data.error || 'Failed to process refund');
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Refund failed: ${errorMessage}`);
    } finally {
      setProcessingPayment(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleCancelPayment = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order?.stripe_payment_intent_id) return;

    setProcessingPayment(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('stripe-payment-intent', {
        body: {
          action: 'cancel_intent',
          orderId,
          paymentIntentId: order.stripe_payment_intent_id
        }
      });

      if (error) throw error;

      if (data.success) {
        alert('Payment authorization cancelled successfully!');
        await loadOrders();
      } else {
        throw new Error(data.error || 'Failed to cancel payment');
      }
    } catch (error) {
      console.error('Error cancelling payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Payment cancellation failed: ${errorMessage}`);
    } finally {
      setProcessingPayment(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const sendOrderEmail = async (orderId: string, emailType: string) => {
    setSendingEmail(prev => ({ ...prev, [`${orderId}_${emailType}`]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('order-email-notifications', {
        body: {
          orderId,
          emailType
        }
      });

      if (error) throw error;

      if (data.success) {
        alert(`${emailType === 'payment_confirmation' ? 'Payment invoice' : 'Delivery confirmation'} sent successfully!`);
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to send email: ${errorMessage}`);
    } finally {
      setSendingEmail(prev => ({ ...prev, [`${orderId}_${emailType}`]: false }));
    }
  };

  const sendPaymentRequest = async (orderId: string) => {
    setSendingPaymentRequest(prev => ({ ...prev, [orderId]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('interac-payment-request', {
        body: {
          orderId
        }
      });

      if (error) throw error;

      if (data.success) {
        alert('Payment request sent successfully!');
      } else {
        throw new Error(data.error || 'Failed to send payment request');
      }
    } catch (error) {
      console.error('Error sending payment request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to send payment request: ${errorMessage}`);
    } finally {
      setSendingPaymentRequest(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'picked_up':
        return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery':
        return 'bg-indigo-100 text-indigo-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'pre_authorized':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredProducts = products.filter(product => {
    if (!productSearch) return true;
    const searchLower = productSearch.toLowerCase();
    return product.name.toLowerCase().includes(searchLower) ||
           product.category.toLowerCase().includes(searchLower);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Order Management</h1>
        <p className="text-sm md:text-base text-gray-600">Manage customer orders and deliveries</p>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="picked_up">Picked Up</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-xs md:text-sm font-medium text-gray-900">#{order.order_number}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            year: window.innerWidth > 768 ? 'numeric' : '2-digit'
                          })}
                        </div>
                        <div className="text-xs text-blue-600 capitalize">
                          {order.payment_method?.replace('_', ' ') || 'card'}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-xs md:text-sm font-medium text-gray-900 truncate max-w-[120px] md:max-w-none">
                          {order.customer?.first_name} {order.customer?.last_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[120px] md:max-w-none">{order.customer?.email}</div>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      {order.payment_method === 'interac' ? (
                        <select
                          value={order.payment_status || 'pending'}
                          onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getPaymentStatusColor(order.payment_status)} pr-6 min-w-[90px]`}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="failed">Failed</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(order.payment_status || 'paid')}`}>
                          {order.payment_status === 'pre_authorized' ? 'Pre-Auth' : 
                           order.payment_status === 'paid' ? 'Paid' : 
                           order.payment_status || 'Paid'}
                        </span>
                      )}
                      {order.payment_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(order.payment_date).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status || 'pending'}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 ${getStatusColor(order.status)} pr-6 min-w-[100px]`}
                      >
                        {order.payment_status === 'paid' ? (
                          <>
                            <option value="picked_up">Picked Up</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </>
                        ) : (
                          <>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="preparing">Preparing</option>
                            <option value="picked_up">Picked Up</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </>
                        )}
                      </select>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.driver?.id || ''}
                        onChange={(e) => assignDriver(order.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1 pr-6 min-w-[120px]"
                      >
                        <option value="">Assign Driver</option>
                        {drivers.map(driver => (
                          <option key={driver.id} value={driver.id}>
                            {driver.first_name} {driver.last_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm text-gray-900">
                      ${(Number(order.subtotal || 0) + Number(order.tax || 0) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0) - Number(order.discount || 0)).toFixed(2)}
                    </td>
                    <td className="px-3 md:px-6 py-4 whitespace-nowrap text-xs md:text-sm font-medium">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-900 cursor-pointer whitespace-nowrap"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No orders found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-900">
                  Order #{selectedOrder.order_number}
                </h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-close-line text-xl"></i>
                  </div>
                </button>
              </div>

              <div className="space-y-6">
                {/* Stripe Payment Actions */}
                {selectedOrder.payment_method === 'card' && selectedOrder.stripe_payment_intent_id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-blue-900 mb-3">Stripe Payment Management</h3>

                    {selectedOrder.payment_status === 'pre_authorized' && (
                      <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-900 font-medium mb-2">📋 Authorize-First Capture-Later Flow</p>
                        <ol className="text-xs text-blue-800 space-y-1 ml-4 list-decimal">
                          <li>Customer payment is authorized (not yet captured)</li>
                          <li>Update order items/weights below as needed</li>
                          <li>Final amount will be calculated automatically</li>
                          <li>Click "Capture Payment" to charge the customer's card</li>
                        </ol>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 mb-3">
                      {selectedOrder.payment_status === 'pre_authorized' && (
                        <button
                          onClick={() => handleManualPaymentCapture(selectedOrder.id)}
                          disabled={processingPayment[selectedOrder.id]}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                        >
                          {processingPayment[selectedOrder.id] ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Processing...
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <i className="ri-bank-card-line"></i>
                              </div>
                              Capture Payment (${Number(selectedOrder.total).toFixed(2)})
                            </div>
                          )}
                        </button>
                      )}

                      {selectedOrder.payment_status === 'pre_authorized' && (
                        <button
                          onClick={() => handleCancelPayment(selectedOrder.id)}
                          disabled={processingPayment[selectedOrder.id]}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                        >
                          {processingPayment[selectedOrder.id] ? 'Processing...' : 'Cancel Authorization'}
                        </button>
                      )}

                      {selectedOrder.payment_status === 'paid' && (
                        <button
                          onClick={() => {
                            const refundAmount = prompt(`Enter refund amount (max: $${selectedOrder.total}):`);
                            if (refundAmount && !isNaN(parseFloat(refundAmount))) {
                              handlePaymentRefund(selectedOrder.id, parseFloat(refundAmount));
                            }
                          }}
                          disabled={processingPayment[selectedOrder.id]}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                        >
                          Issue Refund
                        </button>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-blue-700">Payment Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                          {selectedOrder.payment_status === 'pre_authorized' ? 'Pre-Authorized' :
                           selectedOrder.payment_status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-blue-700">
                      {selectedOrder.payment_status === 'pre_authorized'
                        ? 'Payment is pre-authorized. Update order items/weights below, then capture the final amount.'
                        : 'Payment has been captured. You can issue partial or full refunds if needed.'}
                    </p>
                  </div>
                )}

                {/* Payment Actions for Interac e-Transfer */}
                {selectedOrder.payment_method === 'interac' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-orange-900 mb-3">Interac e-Transfer Payment</h3>
                    <div className="flex flex-wrap gap-3 mb-3">
                      <button
                        onClick={() => sendPaymentRequest(selectedOrder.id)}
                        disabled={sendingPaymentRequest[selectedOrder.id]}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                      >
                        {sendingPaymentRequest[selectedOrder.id] ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sending...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-bank-line"></i>
                            </div>
                            Send Payment Request
                          </div>
                        )}
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-orange-700">Payment Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                          {selectedOrder.payment_status || 'Pending'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-orange-700">
                      Customer will receive payment instructions to send e-Transfer to <strong>payments@groceree.ca</strong> with order number in the message.
                    </p>
                  </div>
                )}

                {/* Email Actions */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-base font-semibold text-green-900 mb-3">Email Notifications</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => sendOrderEmail(selectedOrder.id, 'payment_confirmation')}
                      disabled={sendingEmail[`${selectedOrder.id}_payment_confirmation`]}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                    >
                      {sendingEmail[`${selectedOrder.id}_payment_confirmation`] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-mail-send-line"></i>
                          </div>
                          Send Payment Invoice
                        </div>
                      )}
                    </button>
                    
                    <button
                      onClick={() => sendOrderEmail(selectedOrder.id, 'delivery_confirmation')}
                      disabled={sendingEmail[`${selectedOrder.id}_delivery_confirmation`]}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                    >
                      {sendingEmail[`${selectedOrder.id}_delivery_confirmation`] ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center">
                            <i className="ri-truck-line"></i>
                          </div>
                          Send Delivery Confirmation
                        </div>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    Send professional email notifications to the customer with detailed invoice and order information.
                  </p>
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Name</div>
                        <div className="font-medium">
                          {selectedOrder.customer?.first_name} {selectedOrder.customer?.last_name}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Email</div>
                        <div className="font-medium break-all">{selectedOrder.customer?.email}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Phone</div>
                        <div className="font-medium">{selectedOrder.customer?.phone}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Payment Method</div>
                        <div className="font-medium capitalize">
                          {selectedOrder.payment_method?.replace('_', ' ') || 'Credit Card'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="text-sm text-gray-600">Delivery Address</div>
                      <div className="font-medium break-words">{selectedOrder.delivery_address}</div>
                    </div>
                    {selectedOrder.delivery_instructions && (
                      <div className="mt-4">
                        <div className="text-sm text-gray-600">Delivery Instructions</div>
                        <div className="font-medium break-words bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900">
                          {selectedOrder.delivery_instructions}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Items with Cart-Style Editing */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">Order Items</h3>
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 flex items-center justify-center">
                          <i className="ri-add-line"></i>
                        </div>
                        Add Item
                      </div>
                    </button>
                  </div>
                  
                  {/* Updated order items rendering */}
                  <div className="space-y-3">
                    {selectedOrder.order_items?.map((item) => {
                      const imageKey = `admin-order-${selectedOrder.id}-item-${item.id}`;
                      return (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        {imageErrors[imageKey] ? (
                          <div className="w-16 h-16 bg-gray-300 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ri-image-line text-xl text-gray-500"></i>
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={`https://readdy.ai/api/search-image?query=Professional%20product%20photography%20of%20${encodeURIComponent(item.products?.name || 'grocery product')}%20on%20clean%20white%20background%2C%20high%20quality%2C%20commercial%20food%20photography%20style&width=100&height=100&seq=${item.id}&orientation=squarish`}
                            alt={item.products?.name || 'Product'}
                            className="w-16 h-16 object-cover object-center rounded-lg flex-shrink-0"
                            onError={() => handleImageError(imageKey)}
                          />
                        )}

                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{item.products?.name}</h4>
                          <p className="text-sm text-gray-600">${item.unit_price.toFixed(2)} per {item.products?.unit}</p>
                          {(item.bottle_price ?? item.products?.bottle_price) != null && (
                            <p className="text-xs text-blue-600">Bottle: ${(item.bottle_price ?? item.products?.bottle_price)!.toFixed(2)}</p>
                          )}
                          {item.products?.scalable && item.final_weight && (
                            <p className="text-xs text-blue-600">Final weight: {item.final_weight} {item.products.unit}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuantityDecrement(item.id, selectedOrder.id)}
                            disabled={updatingItems[item.id]}
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full disabled:opacity-50"
                          >
                            <i className="ri-subtract-line text-sm"></i>
                          </button>

                          <input
                            type="number"
                            value={editingItems[item.id] !== undefined ? editingItems[item.id] : item.quantity}
                            onChange={(e) => handleQuantityEdit(item.id, e.target.value)}
                            onBlur={() => {
                              if (editingItems[item.id] !== undefined) {
                                handleQuantitySave(item.id, selectedOrder.id);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleQuantitySave(item.id, selectedOrder.id);
                              } else if (e.key === 'Escape') {
                                handleQuantityCancel(item.id);
                              }
                            }}
                            step={item.products?.scalable ? 0.01 : 1}
                            min={item.products?.scalable ? 0.01 : 1}
                            className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={updatingItems[item.id]}
                          />

                          <button
                            onClick={() => handleQuantityIncrement(item.id, selectedOrder.id)}
                            disabled={updatingItems[item.id]}
                            className="w-8 h-8 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full disabled:opacity-50"
                          >
                            <i className="ri-add-line text-sm"></i>
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="font-medium">${(item.total_price + ((item.bottle_price || item.products?.bottle_price || 0) * item.quantity)).toFixed(2)}</div>
                          {(item.bottle_price || item.products?.bottle_price) && (
                            <div className="text-xs text-blue-600">+${((item.bottle_price || item.products?.bottle_price || 0) * item.quantity).toFixed(2)} bottle</div>
                          )}
                          {updatingItems[item.id] && (
                            <div className="text-xs text-blue-600">Updating...</div>
                          )}
                        </div>

                        <button
                          onClick={() => removeOrderItem(item.id, selectedOrder.id)}
                          className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-full"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                      );
                    })}
                    
                    {selectedOrder.order_items?.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No items in this order
                      </div>
                    )}
                  </div>

                  {/* Order Totals with Tax Breakdown */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Subtotal</span>
                        <span>${(selectedOrder.subtotal || 0).toFixed(2)}</span>
                      </div>
                      {selectedOrder.gst > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">GST (5%)</span>
                          <span>${(selectedOrder.gst || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.pst > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">PST (7%)</span>
                          <span>${(selectedOrder.pst || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.delivery_fee > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Delivery Fee</span>
                          <span>${(selectedOrder.delivery_fee || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(selectedOrder.discount || 0) > 0 && (
                        <div className="flex justify-between items-center text-green-600">
                          <span>Discount</span>
                          <span>-${(selectedOrder.discount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      {(selectedOrder.tip_amount || 0) > 0 && (
                        <div className="flex justify-between items-center text-gray-700">
                          <span>Tip</span>
                          <span>${(selectedOrder.tip_amount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-lg font-bold pt-2 border-t">
                        <span>Total</span>
                        <span>${(Number(selectedOrder.subtotal || 0) + Number(selectedOrder.tax || 0) + Number(selectedOrder.delivery_fee || 0) + Number(selectedOrder.tip_amount || 0) - Number(selectedOrder.discount || 0)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Status */}
                <div>
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Order Status</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">Current Status:</span>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                        {selectedOrder.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getPaymentStatusColor(selectedOrder.payment_status)}`}>
                        {selectedOrder.payment_status === 'pre_authorized' ? 'Pre-Authorized' : 
                         selectedOrder.payment_status || 'Paid'}
                      </span>
                    </div>
                    {selectedOrder.payment_date && (
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-600">Payment Date:</span>
                        <span className="font-medium">
                          {new Date(selectedOrder.payment_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedOrder.driver && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Assigned Driver:</span>
                        <span className="font-medium">
                          {selectedOrder.driver.first_name} {selectedOrder.driver.last_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Product to Order</h3>
              <button
                onClick={() => setShowAddProduct(false)}
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-close-line text-xl"></i>
                </div>
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProducts.map((product) => {
                const isInOrder = selectedOrder?.order_items?.some(item => item.products?.id === product.id);
                return (
                  <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                    {imageErrors[`admin-product-${product.id}`] ? (
                      <div className="w-full h-32 bg-gray-300 rounded-lg mb-3 flex items-center justify-center">
                        <i className="ri-image-line text-2xl text-gray-500"></i>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`https://readdy.ai/api/search-image?query=Professional%20product%20photography%20of%20${encodeURIComponent(product.name)}%20on%20clean%20white%20background%2C%20high%20quality%2C%20commercial%20food%20photography%20style&width=200&height=150&seq=${product.id}&orientation=landscape`}
                        alt={product.name}
                        className="w-full h-32 object-cover object-top rounded-lg mb-3"
                        onError={() => handleImageError(`admin-product-${product.id}`)}
                      />
                    )}
                    <h4 className="font-medium text-gray-900 mb-1">{product.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">${product.price.toFixed(2)} per {product.unit}</p>
                    <p className="text-xs text-gray-500 mb-3">Stock: {product.stock_quantity} {product.unit}</p>
                    
                    {isInOrder && (
                      <p className="text-xs text-blue-600 mb-2">✓ Already in order</p>
                    )}
                    
                    <button
                      onClick={() => {
                        const quantity = prompt(`Enter quantity for ${product.name}:`, product.scalable ? '0.25' : '1');
                        if (quantity && !isNaN(parseFloat(quantity))) {
                          addProductToOrder(product.id, parseFloat(quantity), selectedOrder!.id);
                        }
                      }}
                      disabled={addingProduct || product.stock_quantity <= 0}
                      className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                    >
                      {product.stock_quantity <= 0 ? 'Out of Stock' : 'Add to Order'}
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
