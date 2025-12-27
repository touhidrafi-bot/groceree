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
    final_weight: number | null;
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
  bottle_price: number | null;
  unit: string;
  scalable: boolean | null;
  tax_type: string | null;
  stock_quantity: number | null;
  category: string;
}
type BooleanMap = Record<string, boolean>;

type Driver = {
  id: string;
  first_name: string;
  last_name: string;
};


export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [sendingEmail, setSendingEmail] = useState<BooleanMap>({});
  const [sendingPaymentRequest, setSendingPaymentRequest] = useState<BooleanMap>({});
  const [processingPayment, setProcessingPayment] = useState<BooleanMap>({});
  const [editingItems, setEditingItems] = useState<Record<string, string>>({});
  const [_updatingItems, setUpdatingItems] = useState<BooleanMap>({});
  const [_imageErrors, setImageErrors] = useState<BooleanMap>({});

  const [_showAddProduct, setShowAddProduct] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [_addingProduct, setAddingProduct] = useState<boolean>(false);

  const _handleImageError = (imageKey: string) => {
  setImageErrors(prev => {
    if (prev[imageKey]) return prev; // already marked, do nothing
    return { ...prev, [imageKey]: true };
  });
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
            products(id, name, unit, scalable, tax_type, stock_quantity, bottle_price)
          )
        `;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(baseSelect)
        .order('created_at', { ascending: false });

      if (error) {
        const message = (error as any)?.message || '';
        const details = (error as any)?.details || null;
        const code = (error as any)?.code || null;
        const hint = (error as any)?.hint || null;
        console.error('Supabase error loading admin orders:', { message, code, details, hint });
        setOrders([]);
        return;
      }

      const formattedOrders: Order[] = (data || []).map((order: any) => {
        const orderItems = (order.order_items || []).map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          final_weight: item.final_weight,
          bottle_price: item.bottle_price,
          products: Array.isArray(item.products) ? item.products[0] : item.products
        }));

        return {
          ...order,
          order_items: orderItems,
          customer: Array.isArray(order.customer) ? order.customer[0] : order.customer,
          driver: Array.isArray(order.driver) ? order.driver[0] : order.driver
        };
      });

      setOrders(formattedOrders);
    } catch (err) {
      const message = (err as any)?.message || String(err);
      const details = (err as any)?.details || null;
      console.error('Unexpected error loading admin orders:', { message, details });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

 const loadDrivers = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('role', 'driver')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    setDrivers((data as Driver[]) ?? []);
  } catch (err) {
    console.error('Error loading drivers:', err);
    setDrivers([]);
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
      const itemTotal = item.total_price;
      subtotal += itemTotal;

      if (item.products.tax_type === 'gst') {
        totalGST += itemTotal * 0.05;
      } else if (item.products.tax_type === 'gst_pst') {
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
      total: Math.round(total * 100) / 100
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

      if (status === 'cancelled' && currentOrder.status !== 'cancelled') {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          for (const orderItem of currentOrder.order_items) {
            const quantity = orderItem.quantity;
            const productId = orderItem.products.id;

            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', productId)
              .single();

            if (product) {
              const previousStock = product.stock_quantity ?? 0;
              const newStock = previousStock + quantity;

              await supabase
                .from('products')
                .update({ stock_quantity: newStock })
                .eq('id', productId);

              await supabase
                .from('stock_adjustments')
                .insert({
                  product_id: productId,
                  adjustment_type: 'order_cancelled',
                  quantity_change: quantity,
                  previous_stock: previousStock,
                  new_stock: newStock,
                  reason: `Order ${currentOrder.order_number} cancelled - ${quantity} units returned to stock`,
                  adjusted_by: user.id
                });
            }
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

      if (orderItem.products.scalable) {
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

      if (orderItem.products.scalable) {
        updateData.final_weight = finalQuantity;
      }

      const { error: itemError } = await supabase
        .from('order_items')
        .update(updateData)
        .eq('id', orderItemId);

      if (itemError) {
        throw new Error(`Failed to update item ${orderItem.products.name}: ${itemError.message}`);
      }

      const quantityDifference = finalQuantity - orderItem.quantity;

      if (quantityDifference !== 0) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          const stockAdjustmentQuantity = -quantityDifference;

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

  const _addProductToOrder = async (productId: string, quantity: number, orderId: string) => {
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

      if ((product.stock_quantity ?? 0) < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock_quantity ?? 0} ${product.unit}`);
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

        const previousStock = product.stock_quantity ?? 0;
        const newStock = Math.max(0, previousStock - finalQuantity);
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', productId);

        if (stockError) {
          console.error('Error updating product stock:', stockError);
        } else {
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

  const _removeOrderItem = async (orderItemId: string, orderId: string) => {
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
          const previousStock = product.stock_quantity ?? 0;
          const restoredStock = previousStock + orderItem.quantity;

          const { error: stockError } = await supabase
            .from('products')
            .update({ stock_quantity: restoredStock })
            .eq('id', orderItem.products.id);

          if (stockError) {
            console.error('Error restoring product stock:', stockError);
          } else if (user) {
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

  const _handleQuantityIncrement = (orderItemId: string, orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const orderItem = order.order_items.find(item => item.id === orderItemId);
    if (!orderItem) return;

    const step = orderItem.products.scalable ? 0.01 : 1;
    const newQuantity = orderItem.quantity + step;
    
    updateItemQuantity(orderItemId, newQuantity, orderId);
  };

  const _handleQuantityDecrement = (orderItemId: string, orderId: string) => {
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

  const _handleQuantityEdit = (orderItemId: string, value: string) => {
    setEditingItems(prev => ({ ...prev, [orderItemId]: value }));
  };

  const _handleQuantitySave = (orderItemId: string, orderId: string) => {
    const value = editingItems[orderItemId];
    const newQuantity = parseFloat(value);
    
    if (isNaN(newQuantity) || newQuantity <= 0) {
      alert('Please enter a valid quantity');
      return;
    }
    
    updateItemQuantity(orderItemId, newQuantity, orderId);
  };

  const _handleQuantityCancel = (orderItemId: string) => {
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

  const _handlePaymentRefund = async (orderId: string, amount?: number) => {
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

  const _filteredProducts = products.filter(product => {
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
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Order Management</h1>
        <p className="text-xs sm:text-sm lg:text-base text-gray-600 mt-1">Manage customer orders and deliveries</p>
      </div>

      <div className="bg-white rounded-lg lg:rounded-xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-200">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="w-full">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 lg:hidden">Search Orders</label>
            <input
              type="text"
              placeholder="Search by order # or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              aria-label="Search orders"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2 lg:hidden">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent pr-8"
              aria-label="Filter by status"
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

      <div className="bg-white rounded-lg lg:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="lg:hidden">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No orders found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-sm font-bold text-gray-900">#{order.order_number}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(order.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-blue-600 hover:text-blue-900 font-medium text-sm whitespace-nowrap ml-2"
                    >
                      View
                    </button>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-600">Customer</div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer?.first_name} {order.customer?.last_name}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-gray-600">Payment</div>
                        <div className="text-xs font-semibold mt-1">
                          {order.payment_method === 'interac' ? (
                            <select
                              value={order.payment_status || 'pending'}
                              onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                              className={`text-xs font-semibold rounded-full px-2 py-1 border-0 w-full ${getPaymentStatusColor(order.payment_status)}`}
                            >
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="failed">Failed</option>
                            </select>
                          ) : (
                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(order.payment_status || 'paid')}`}>
                              {order.payment_status === 'pre_authorized' ? 'Pre-Auth' : 
                               order.payment_status === 'paid' ? 'Paid' : 
                               order.payment_status || 'Paid'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-600">Status</div>
                        <select
                          value={order.status || 'pending'}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2 py-1 border-0 w-full mt-1 ${getStatusColor(order.status)}`}
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
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-600">Driver</div>
                      <select
                        value={order.driver?.id || ''}
                        onChange={(e) => assignDriver(order.id, e.target.value)}
                        className="text-xs border border-gray-300 rounded px-2 py-1.5 w-full mt-1"
                      >
                        <option value="">Assign Driver</option>
                        {drivers.map(driver => (
                          <option key={driver.id} value={driver.id}>
                            {driver.first_name} {driver.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-600">Total</span>
                    <span className="text-sm font-bold text-gray-900">
                      ${(Number(order.subtotal || 0) + Number(order.tax || 0) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0) - Number(order.discount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">#{order.order_number}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(order.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-blue-600 capitalize mt-1">
                        {order.payment_method?.replace('_', ' ') || 'card'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer?.first_name} {order.customer?.last_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{order.customer?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {order.payment_method === 'interac' ? (
                      <div>
                        <select
                          value={order.payment_status || 'pending'}
                          onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2 py-1 border-0 pr-6 ${getPaymentStatusColor(order.payment_status)}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="failed">Failed</option>
                        </select>
                        {order.payment_date && (
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(order.payment_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(order.payment_status || 'paid')}`}>
                          {order.payment_status === 'pre_authorized' ? 'Pre-Auth' : 
                           order.payment_status === 'paid' ? 'Paid' : 
                           order.payment_status || 'Paid'}
                        </span>
                        {order.payment_date && (
                          <div className="text-xs text-gray-500 mt-2">
                            {new Date(order.payment_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={order.status || 'pending'}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className={`text-xs font-semibold rounded-full px-2 py-1 border-0 pr-6 ${getStatusColor(order.status)}`}
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
                  <td className="px-6 py-4">
                    <select
                      value={order.driver?.id || ''}
                      onChange={(e) => assignDriver(order.id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1 pr-6"
                    >
                      <option value="">Assign Driver</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.first_name} {driver.last_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ${(Number(order.subtotal || 0) + Number(order.tax || 0) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0) - Number(order.discount || 0)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-blue-600 hover:text-blue-900 cursor-pointer"
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

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl lg:rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 lg:p-6 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                Order #{selectedOrder.order_number}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer p-2 -mr-2"
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <i className="ri-close-line text-xl"></i>
                </div>
              </button>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
              {selectedOrder.payment_method === 'card' && selectedOrder.stripe_payment_intent_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-blue-900 mb-3">Stripe Payment Management</h3>
                  {selectedOrder.payment_status === 'pre_authorized' && (
                    <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4">
                      <p className="text-xs sm:text-sm text-blue-900 font-medium mb-2">📋 Authorize-First Capture-Later</p>
                      <ol className="text-xs text-blue-800 space-y-1 ml-4 list-decimal">
                        <li>Payment authorized (not captured)</li>
                        <li>Update items/weights below</li>
                        <li>Capture to charge customer</li>
                      </ol>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-3">
                    {selectedOrder.payment_status === 'pre_authorized' && (
                      <button
                        onClick={() => handleManualPaymentCapture(selectedOrder.id)}
                        disabled={processingPayment[selectedOrder.id]}
                        className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2"
                      >
                        {processingPayment[selectedOrder.id] ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="hidden sm:inline">Processing...</span>
                          </>
                        ) : (
                          <>
                            <i className="ri-bank-card-line"></i>
                            <span>Capture</span>
                          </>
                        )}
                      </button>
                    )}
                    {selectedOrder.payment_status === 'pre_authorized' && (
                      <button
                        onClick={() => handleCancelPayment(selectedOrder.id)}
                        disabled={processingPayment[selectedOrder.id]}
                        className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-xs sm:text-sm font-medium whitespace-nowrap"
                      >
                        {processingPayment[selectedOrder.id] ? 'Processing...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.payment_method === 'interac' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-orange-900 mb-3">Interac e-Transfer</h3>
                  <button
                    onClick={() => sendPaymentRequest(selectedOrder.id)}
                    disabled={sendingPaymentRequest[selectedOrder.id]}
                    className="px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2"
                  >
                    {sendingPaymentRequest[selectedOrder.id] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">Sending...</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-bank-line"></i>
                        <span className="hidden sm:inline">Send Payment Request</span>
                        <span className="sm:hidden">Send Request</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-semibold text-green-900 mb-3">Email Notifications</h3>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={() => sendOrderEmail(selectedOrder.id, 'payment_confirmation')}
                    disabled={sendingEmail[`${selectedOrder.id}_payment_confirmation`]}
                    className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2"
                  >
                    {sendingEmail[`${selectedOrder.id}_payment_confirmation`] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">Sending...</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-mail-send-line"></i>
                        <span className="hidden sm:inline">Invoice</span>
                        <span className="sm:hidden">Invoice</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => sendOrderEmail(selectedOrder.id, 'delivery_confirmation')}
                    disabled={sendingEmail[`${selectedOrder.id}_delivery_confirmation`]}
                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs sm:text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2"
                  >
                    {sendingEmail[`${selectedOrder.id}_delivery_confirmation`] ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">Sending...</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-truck-line"></i>
                        <span className="hidden sm:inline">Delivery</span>
                        <span className="sm:hidden">Delivery</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 mb-3">Customer Info</h3>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <div className="text-xs sm:text-sm text-gray-600">Name</div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedOrder.customer?.first_name} {selectedOrder.customer?.last_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-600">Email</div>
                      <div className="text-sm font-medium break-all">{selectedOrder.customer?.email}</div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-600">Phone</div>
                      <div className="text-sm font-medium">{selectedOrder.customer?.phone}</div>
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm text-gray-600">Payment Method</div>
                      <div className="text-sm font-medium capitalize">
                        {selectedOrder.payment_method?.replace('_', ' ') || 'Card'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs sm:text-sm text-gray-600">Delivery Address</div>
                    <div className="text-sm font-medium break-words">{selectedOrder.delivery_address}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
