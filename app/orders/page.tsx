'use client';

import { useState, useEffect } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/auth';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  tip_amount?: number;
  subtotal: number;
  tax: number;
  gst: number;
  pst: number;
  delivery_fee: number;
  discount: number;
  created_at: string;
  delivery_address: string;
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
      image_url: string;
      unit: string;
      scalable: boolean;
      in_stock: number;
      tax_type?: 'none' | 'gst' | 'gst_pst';
      bottle_price?: number;
    };
  }[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  bottle_price?: number;
  image_url: string;
  unit: string;
  scalable: boolean;
  in_stock: number;
  category: string;
  tax_type?: 'none' | 'gst' | 'gst_pst';
}

interface ImageErrorState {
  [key: string]: boolean;
}

function OrderStatusContent() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [_editingItems, _setEditingItems] = useState<{[key: string]: any}>({});
  const [savingChanges, setSavingChanges] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [imageErrors, setImageErrors] = useState<ImageErrorState>({});

  const handleImageError = (imageKey: string) => {
    setImageErrors(prev => ({ ...prev, [imageKey]: true }));
  };
  
  const orderId = searchParams.get('orderId');
  const orderNumber = searchParams.get('orderNumber');
  const total = searchParams.get('total');
  const isNewOrder = orderId && orderNumber && total;

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            id,
            quantity,
            unit_price,
            total_price,
            final_weight,
            bottle_price,
            products(id, name, image_url, unit, scalable, in_stock, tax_type, bottle_price)
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        const msg = error?.message || JSON.stringify(error);
        console.error('Supabase error loading orders:', {
          message: error?.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          status: (error as any)?.status
        });
        setLoadError(msg);
        setOrders(data || []);
        setOrdersLoading(false);
        return;
      }

      setOrders(data || []);
    } catch (err: any) {
      const details = err?.message || JSON.stringify(err);
      console.error('Unexpected error loading orders:', err);
      setLoadError(details);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadAvailableProducts = async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-products', {
        body: { 
          category: '',
          search: '',
          limit: 50
        }
      });

      if (error) throw error;
      setAvailableProducts(data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Remove the old useEffect for search and replace with this simpler approach
  useEffect(() => {
    if (editingOrder) {
      loadAvailableProducts();
    }
  }, [editingOrder]);

  // Filter products based on search term
  const filteredProducts = availableProducts.filter(product => {
    if (!searchTerm || searchTerm.length < 2) {
      return true; // Show all products when search is empty or too short
    }
    
    const searchLower = searchTerm.toLowerCase();
    const productName = product.name || '';
    const productCategory = product.category || '';
    
    return (
      productName.toLowerCase().includes(searchLower) ||
      productCategory.toLowerCase().includes(searchLower)
    );
  });

  const canEditOrder = (order: Order) => {
    return order.status === 'pending' || order.status === 'confirmed';
  };

  const startEditingOrder = async (order: Order) => {
    if (!canEditOrder(order)) return;
    
    setEditingOrder(order);
    _setEditingItems({});
    await loadAvailableProducts();
  };

  // Calculate tax based on tax type like the cart system
  const calculateItemTax = (subtotal: number, taxType: string = 'none') => {
    switch (taxType) {
      case 'gst':
        return { gst: subtotal * 0.05, pst: 0, total: subtotal * 0.05 };
      case 'gst_pst':
        return { gst: subtotal * 0.05, pst: subtotal * 0.07, total: subtotal * 0.12 };
      case 'none':
      default:
        return { gst: 0, pst: 0, total: 0 };
    }
  };

  const calculateOrderTotals = (items: any[], baseOrder?: Order | null) => {
    const newSubtotal = items.reduce((sum, item) => sum + item.total_price, 0);

    // Calculate taxes by item type
    let totalGST = 0;
    let totalPST = 0;

    items.forEach(item => {
      const itemSubtotal = item.total_price;
      const taxes = calculateItemTax(itemSubtotal, item.products.tax_type);
      totalGST += taxes.gst;
      totalPST += taxes.pst;
    });

    const totalTax = totalGST + totalPST;
    const deliveryFeeToUse = baseOrder?.delivery_fee ?? (editingOrder?.delivery_fee ?? 5.00);
    const discountToUse = baseOrder?.discount ?? (editingOrder?.discount ?? 0);
    const tipToUse = baseOrder?.tip_amount ?? (editingOrder?.tip_amount ?? 0);

    const newTotal = newSubtotal + totalTax + deliveryFeeToUse - discountToUse + tipToUse;

    return {
      subtotal: newSubtotal,
      gst: totalGST,
      pst: totalPST,
      tax: totalTax,
      total: newTotal
    };
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (!editingOrder) return;

    const updatedItems = editingOrder.order_items.map(item => {
      if (item.id === itemId) {
        // Apply proper quantity rounding based on scalable property
        let adjustedQuantity;
        if (item.products.scalable) {
          adjustedQuantity = Math.round(newQuantity * 4) / 4; // Round to nearest 0.25
        } else {
          adjustedQuantity = Math.round(newQuantity); // Round to whole number
        }

        const newTotalPrice = adjustedQuantity * (item.unit_price + (item.bottle_price || 0));
        return {
          ...item,
          quantity: adjustedQuantity,
          total_price: newTotalPrice,
          final_weight: item.products.scalable ? adjustedQuantity : item.final_weight
        };
      }
      return item;
    });

    const totals = calculateOrderTotals(updatedItems, editingOrder);

    setEditingOrder({
      ...editingOrder,
      order_items: updatedItems,
      ...totals
    });
  };

  const removeItem = (itemId: string) => {
    if (!editingOrder) return;

    const updatedItems = editingOrder.order_items.filter(item => item.id !== itemId);
    const totals = calculateOrderTotals(updatedItems, editingOrder);

    setEditingOrder({
      ...editingOrder,
      order_items: updatedItems,
      ...totals
    });
  };

  const addNewItem = (product: Product, quantity: number) => {
    if (!editingOrder) return;

    // Apply proper quantity rounding based on scalable property
    let adjustedQuantity;
    if (product.scalable) {
      adjustedQuantity = Math.round(quantity * 4) / 4; // Round to nearest 0.25
    } else {
      adjustedQuantity = Math.round(quantity); // Round to whole number
    }

    const newItem = {
      id: `temp_${Date.now()}`,
      quantity: adjustedQuantity,
      unit_price: product.price,
      bottle_price: product.bottle_price || 0,
      total_price: adjustedQuantity * (product.price + (product.bottle_price || 0)),
      final_weight: product.scalable ? adjustedQuantity : undefined,
      products: {
        ...product,
        image_url: product.image_url,
        tax_type: product.tax_type || 'none'
      }
    };

    const updatedItems = [...editingOrder.order_items, newItem];
    const totals = calculateOrderTotals(updatedItems, editingOrder);

    setEditingOrder({
      ...editingOrder,
      order_items: updatedItems,
      ...totals
    });
  };

  const getQuantityStep = (isScalable: boolean) => {
    return isScalable ? 0.25 : 1;
  };

  const saveOrderChanges = async () => {
    if (!editingOrder) return;

    setSavingChanges(true);
    try {
      // Delete existing order items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', editingOrder.id);

      if (deleteError) {
        console.error('Error deleting order items:', deleteError);
        throw deleteError;
      }

      // Insert updated order items
      const orderItemsToInsert = editingOrder.order_items.map(item => ({
        order_id: editingOrder.id,
        product_id: item.products.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        bottle_price: item.bottle_price || 0,
        total_price: item.total_price,
        final_weight: item.final_weight
      }));

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert);

      if (insertError) {
        console.error('Error inserting order items:', insertError);
        throw insertError;
      }

      // Update order totals with new tax structure
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          subtotal: editingOrder.subtotal,
          tax: editingOrder.tax,
          gst: editingOrder.gst,
          pst: editingOrder.pst,
          delivery_fee: editingOrder.delivery_fee || 0,
          discount: editingOrder.discount || 0,
          tip_amount: editingOrder.tip_amount || 0,
          total: editingOrder.total
        })
        .eq('id', editingOrder.id);

      if (updateError) {
        console.error('Error updating order:', updateError);
        throw updateError;
      }

      // Log the edit in order history
      const { error: historyError } = await supabase
        .from('order_edit_history')
        .insert({
          order_id: editingOrder.id,
          edited_by: user?.id,
          edit_type: 'customer_edit',
          changes: {
            previous_total: orders.find(o => o.id === editingOrder.id)?.total,
            new_total: editingOrder.total,
            items_modified: true
          },
          edited_at: new Date().toISOString()
        });

      if (historyError) {
        console.error('Error logging edit history:', historyError);
      }

      // Reload orders and close editing
      await loadOrders();
      setEditingOrder(null);
      setSelectedOrder(editingOrder);
      
      alert('Order updated successfully!');
    } catch (error) {
      console.error('Error saving order changes:', error);
      const message = error instanceof Error ? error.message : (error ? String(error) : 'Unknown error');
      alert(`Failed to update order: ${message}. Please try again.`);
    } finally {
      setSavingChanges(false);
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

  if (loading || ordersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <div className="w-12 h-12 flex items-center justify-center">
              <i className="ri-error-warning-line text-4xl text-red-600"></i>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to load orders</h1>
          <p className="text-gray-600 mb-6">{loadError}</p>
          <div className="flex justify-center gap-4">
            <button onClick={() => { setLoadError(null); setOrdersLoading(true); loadOrders(); }} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700">Retry</button>
            <Link href="/" className="text-gray-600 underline">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-100 rounded-full">
            <i className="ri-user-line text-4xl text-gray-400"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Please sign in</h2>
          <p className="text-gray-600 mb-8">You need to be signed in to view your orders</p>
          <Link href="/" className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (isNewOrder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
                <div className="w-12 h-12 flex items-center justify-center">
                  <i className="ri-check-line text-4xl text-green-600"></i>
                </div>
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Placed Successfully!</h1>
              
              <p className="text-gray-600 mb-8 text-lg">
                Thank you for your order! We've received your request and will start preparing your fresh groceries right away.
              </p>

              <div className="bg-gray-50 rounded-xl p-6 mb-8 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Order Number</span>
                  <span className="font-mono font-bold text-gray-900 text-lg">#{orderNumber}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Order Total</span>
                  <span className="font-bold text-gray-900 text-xl">${parseFloat(total).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Payment Method</span>
                  <span className="text-gray-900 font-medium">Cash on Delivery</span>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-8 h-8 flex items-center justify-center mr-3">
                    <i className="ri-truck-line text-2xl text-blue-600"></i>
                  </div>
                  <h3 className="text-lg font-semibold text-blue-900">Delivery Information</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Estimated Delivery</span>
                    <span className="font-medium text-blue-900">Next Available Slot</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Order Status</span>
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Preparing
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Payment</span>
                    <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      On Delivery
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <button 
                  onClick={() => window.location.href = '/orders'}
                  className="block w-full bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap font-semibold text-lg"
                >
                  View All Orders
                </button>
                
                <Link 
                  href="/products" 
                  className="block w-full bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap font-medium"
                >
                  Continue Shopping
                </Link>
                
                <Link 
                  href="/" 
                  className="block w-full text-gray-500 py-2 hover:text-gray-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Back to Home
                </Link>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-6 h-6 flex items-center justify-center mr-2">
                    <i className="ri-notification-line text-gray-400"></i>
                  </div>
                  <span className="text-sm font-medium text-gray-600">Stay Updated</span>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  You'll receive SMS and email updates about your delivery status. Our driver will contact you 15 minutes before arrival.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Recent Orders</h2>
            {orders.length > 0 ? (
              <div className="space-y-4">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">#{order.order_number}</h3>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                        <div className="text-lg font-bold text-gray-900 mt-1">
                          ${parseFloat(order.total.toString()).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-500">This is your first order! More orders will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order History</h1>
          <p className="text-gray-600">Track your grocery delivery orders</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-100 rounded-full">
              <i className="ri-file-list-line text-4xl text-gray-400"></i>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">No orders yet</h2>
            <p className="text-gray-600 mb-8">Start shopping to see your orders here</p>
            <Link href="/products" className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">#{order.order_number}</h3>
                    <p className="text-sm text-gray-500">
                      Ordered on {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <div className="text-lg font-bold text-gray-900 mt-1">
                      ${parseFloat(order.total.toString()).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <h4 className="font-medium text-gray-900 mb-3">Items ({order.order_items?.length || 0})</h4>
                    <div className="space-y-3">
                      {order.order_items?.slice(0, 3).map((item, index) => {
                        const imageKey = `order-${order.id}-item-${index}`;
                        return (
                        <div key={index} className="flex items-center space-x-3">
                          {imageErrors[imageKey] ? (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              <i className="ri-image-line text-lg text-gray-400"></i>
                            </div>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                  src={item.products?.image_url}
                                  alt={item.products?.name}
                                  className="w-12 h-12 object-contain bg-gray-50 rounded-lg p-2 flex-shrink-0"
                                  onError={() => handleImageError(imageKey)}
                                />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 text-sm">
                              {item.products?.name}
                            </div>
                            <div className="text-gray-500 text-xs">
                              {item.quantity} {item.products?.unit} × ${item.unit_price.toFixed(2)}
                            </div>
                            {(item.bottle_price || item.products?.bottle_price) ? (
                              <div className="text-blue-600 text-xs mt-1">
                                Bottle: ${(((item.bottle_price || item.products?.bottle_price) ?? 0) * item.quantity).toFixed(2)}
                              </div>
                            ) : null}
                          </div>
                          <div className="font-medium text-gray-900 text-sm">
                            ${((item.quantity * item.unit_price) + ((item.bottle_price || item.products?.bottle_price || 0) * item.quantity)).toFixed(2)}
                          </div>
                        </div>
                      );
                      })}
                      {(order.order_items?.length || 0) > 3 && (
                        <div className="text-sm text-gray-500 text-center py-2">
                          +{(order.order_items?.length || 0) - 3} more items
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Delivery Address</h4>
                    <div className="text-sm text-gray-600 mb-4">
                      {order.delivery_address}
                    </div>
                    
                    <div className="space-y-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-sm"
                      >
                        View Details
                      </button>
                      
                      {canEditOrder(order) && (
                        <button
                          onClick={() => startEditingOrder(order)}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap text-sm"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 flex items-center justify-center">
                              <i className="ri-edit-line"></i>
                            </div>
                            Edit Order
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && !editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
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
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Status</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedOrder.status)}`}>
                          {selectedOrder.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-gray-600">Order Date:</span>
                        <span className="font-medium">
                          {new Date(selectedOrder.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {canEditOrder(selectedOrder) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => startEditingOrder(selectedOrder)}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap text-sm"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 flex items-center justify-center">
                                <i className="ri-edit-line"></i>
                              </div>
                              Edit This Order
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Address</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="font-medium">{selectedOrder.delivery_address}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h3>
                    <div className="space-y-3">
                      {selectedOrder.order_items?.map((item, index) => {
                        const imageKey = `selected-order-${selectedOrder.id}-item-${index}`;
                        return (
                        <div key={index} className="flex items-center space-x-3 py-3 border-b border-gray-200">
                          {imageErrors[imageKey] ? (
                            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              <i className="ri-image-line text-xl text-gray-400"></i>
                            </div>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.products?.image_url}
                              alt={item.products?.name}
                              className="w-16 h-16 object-contain bg-gray-50 rounded-lg p-2 flex-shrink-0"
                              onError={() => handleImageError(imageKey)}
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {item.products?.name}
                            </div>
                            <div className="text-gray-500 text-sm">
                              {item.quantity} {item.products?.unit} × ${item.unit_price.toFixed(2)}
                            </div>
                            {(item.bottle_price || item.products?.bottle_price) ? (
                              <div className="text-blue-600 text-xs mt-1">
                                Bottle: ${(((item.bottle_price || item.products?.bottle_price) ?? 0) * item.quantity).toFixed(2)}
                              </div>
                            ) : null}
                          </div>
                          <div className="font-medium text-gray-900">
                            ${((item.quantity * item.unit_price) + ((item.bottle_price || item.products?.bottle_price || 0) * item.quantity)).toFixed(2)}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total</span>
                        <span>${parseFloat(selectedOrder.total.toString()).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Editing Modal */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    Edit Order #{editingOrder.order_number}
                  </h2>
                  <button
                    onClick={() => setEditingOrder(null)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <div className="w-6 h-6 flex items-center justify-center">
                      <i className="ri-close-line text-xl"></i>
                    </div>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Current Order Items */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Items</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {editingOrder.order_items.map((item, _index) => {
                        const imageKey = `edit-order-${editingOrder.id}-item-${item.id}`;
                        return (
                        <div key={item.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                          {imageErrors[imageKey] ? (
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              <i className="ri-image-line text-lg text-gray-400"></i>
                            </div>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.products?.image_url}
                              alt={item.products?.name}
                              className="w-12 h-12 object-contain bg-gray-50 rounded-lg p-2 flex-shrink-0"
                              onError={() => handleImageError(imageKey)}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate">
                              {item.products?.name}
                            </div>
                            <div className="text-gray-500 text-xs">
                              ${item.unit_price.toFixed(2)} per {item.products?.unit}
                            </div>
                            {item.bottle_price && item.bottle_price > 0 && (
                              <div className="text-blue-600 text-xs mt-1">
                                Bottle: ${item.bottle_price.toFixed(2)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateItemQuantity(item.id, Math.max(getQuantityStep(item.products.scalable), item.quantity - getQuantityStep(item.products.scalable)))}
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
                            >
                              <i className="ri-subtract-line text-sm"></i>
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity + getQuantityStep(item.products.scalable))}
                              className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
                            >
                              <i className="ri-add-line text-sm"></i>
                            </button>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded cursor-pointer hover:bg-red-200"
                            >
                              <i className="ri-delete-bin-line text-sm"></i>
                            </button>
                          </div>
                        </div>
                      );
                      })}
                    </div>

                    {/* Order Summary */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Order Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${editingOrder.subtotal.toFixed(2)}</span>
                        </div>
                        {editingOrder.gst > 0 && (
                          <div className="flex justify-between">
                            <span>GST (5%):</span>
                            <span>${editingOrder.gst.toFixed(2)}</span>
                          </div>
                        )}
                        {editingOrder.pst > 0 && (
                          <div className="flex justify-between">
                            <span>PST (7%):</span>
                            <span>${editingOrder.pst.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Delivery Fee:</span>
                          <span>${editingOrder.delivery_fee.toFixed(2)}</span>
                        </div>
                        {editingOrder.discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount:</span>
                            <span>-${editingOrder.discount.toFixed(2)}</span>
                          </div>
                        )}
                        {(editingOrder.tip_amount || 0) > 0 && (
                          <div className="flex justify-between items-center text-gray-700">
                            <span>Tip:</span>
                            <span>${Number(editingOrder.tip_amount || 0).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300">
                          <span>Total:</span>
                          <span>${editingOrder.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      <button
                        onClick={saveOrderChanges}
                        disabled={savingChanges}
                        className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap font-medium"
                      >
                        {savingChanges ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Saving Changes...
                          </div>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                      <button
                        onClick={() => setEditingOrder(null)}
                        className="w-full bg-gray-500 text-white py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {/* Add New Items */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Items</h3>
                    
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                      />
                      {loadingProducts && (
                        <div className="flex items-center justify-center mt-2 text-sm text-gray-500">
                          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Searching products...
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => {
                          const isAlreadyInOrder = editingOrder.order_items.some(
                            item => item.products.id === product.id
                          );
                          
                          return (
                            <div key={product.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                              {imageErrors[`product-${product.id}`] ? (
                                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <i className="ri-image-line text-lg text-gray-400"></i>
                                </div>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="w-12 h-12 object-contain bg-gray-50 rounded-lg p-2 flex-shrink-0"
                                    onError={() => handleImageError(`product-${product.id}`)}
                                  />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 text-sm truncate">
                                  {product.name}
                                </div>
                                <div className="text-gray-500 text-xs">
                                  ${product.price.toFixed(2)} per {product.unit}
                                </div>
                                <div className="text-gray-500 text-xs">
                                  Stock: {product.in_stock}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {isAlreadyInOrder ? (
                                  <span className="text-xs text-green-600 font-medium">In Order</span>
                                ) : (
                                  <button
                                    onClick={() => addNewItem(product, getQuantityStep(product.scalable))}
                                    disabled={product.in_stock === 0}
                                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          {searchTerm && searchTerm.length >= 2 ? (
                            <p>No products found matching "{searchTerm}"</p>
                          ) : (
                            <p>Type at least 2 characters to search for products</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    }>
      <OrderStatusContent />
    </Suspense>
  );
}
