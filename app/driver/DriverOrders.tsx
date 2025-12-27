'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/auth';

interface Order {
  id: string;
  order_number: string;
  status: string | null;
  total: number | null;
  delivery_address: string;
  delivery_instructions?: string | null;
  created_at: string | null;
  customer: {
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
  order_items: {
    quantity: number;
    unit_price: number;
    products: {
      name: string;
      unit: string;
    } | null;
  }[];
}

export default function DriverOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      loadDriverOrders();
    }
  }, [user]);

  const loadDriverOrders = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customer:users!orders_customer_id_fkey(first_name, last_name, phone),
          order_items(
            quantity,
            unit_price,
            products(name, unit)
          )
        `)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading driver orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const updateData: any = { status };
      
      // Set delivery time when order is delivered
      if (status === 'delivered') {
        updateData.actual_delivery_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      await loadDriverOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'picked_up':
        return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'preparing':
        return 'picked_up';
      case 'picked_up':
        return 'out_for_delivery';
      case 'out_for_delivery':
        return 'delivered';
      default:
        return currentStatus;
    }
  };

  const getStatusAction = (status: string) => {
    switch (status) {
      case 'preparing':
        return 'Mark as Picked Up';
      case 'picked_up':
        return 'Start Delivery';
      case 'out_for_delivery':
        return 'Mark as Delivered';
      default:
        return 'Update Status';
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!statusFilter) return true;
    return order.status === statusFilter;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Deliveries</h1>
          <p className="text-gray-600">Manage your assigned delivery orders</p>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
          >
            <option value="">All Orders</option>
            <option value="preparing">Preparing</option>
            <option value="picked_up">Picked Up</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOrders.map((order) => (
          <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">#{order.order_number}</h3>
                <p className="text-sm text-gray-500">
                  {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Unknown date'}
                </p>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status || 'unknown')}`}>
                {order.status ? order.status.replace('_', ' ') : 'Unknown'}
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <div className="text-sm font-medium text-gray-700">Customer</div>
                <div className="text-gray-900">
                  {order.customer?.first_name} {order.customer?.last_name}
                </div>
                <div className="text-sm text-gray-600">{order.customer?.phone}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700">Delivery Address</div>
                <div className="text-gray-900 text-sm">{order.delivery_address}</div>
              </div>

              {order.delivery_instructions && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Instructions</div>
                  <div className="text-gray-900 text-sm">{order.delivery_instructions}</div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-gray-700">Order Total</div>
                <div className="text-lg font-bold text-green-600">${Number(order.total).toFixed(2)}</div>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedOrder(order)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap text-sm"
              >
                View Details
              </button>
              
              {order.status !== 'delivered' && (
                <button
                  onClick={() => updateOrderStatus(order.id, getNextStatus(order.status || 'confirmed'))}
                  className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-sm"
                >
                  {getStatusAction(order.status || 'confirmed')}
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex space-x-2">
                <button
                  onClick={() => window.open(`tel:${order.customer?.phone}`, '_self')}
                  className="flex items-center justify-center space-x-1 flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer text-sm"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-phone-line"></i>
                  </div>
                  <span>Call</span>
                </button>
                
                <button
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(order.delivery_address)}`, '_blank')}
                  className="flex items-center justify-center space-x-1 flex-1 bg-purple-50 text-purple-600 py-2 px-3 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer text-sm"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-map-pin-line"></i>
                  </div>
                  <span>Navigate</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4 bg-gray-100 rounded-full">
            <i className="ri-truck-line text-4xl text-gray-400"></i>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries found</h3>
          <p className="text-gray-600">
            {statusFilter ? `No orders with status "${statusFilter.replace('_', ' ')}"` : 'No orders assigned to you yet'}
          </p>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
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
                {/* Customer & Delivery Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <div className="text-sm text-gray-600">Name</div>
                        <div className="font-medium">
                          {selectedOrder.customer?.first_name} {selectedOrder.customer?.last_name}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Phone</div>
                        <div className="font-medium">{selectedOrder.customer?.phone}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Information</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div>
                        <div className="text-sm text-gray-600">Address</div>
                        <div className="font-medium">{selectedOrder.delivery_address}</div>
                      </div>
                      {selectedOrder.delivery_instructions && (
                        <div>
                          <div className="text-sm text-gray-600">Instructions</div>
                          <div className="font-medium">{selectedOrder.delivery_instructions}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {selectedOrder.order_items?.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                        <div>
                          <div className="font-medium">{item.products?.name}</div>
                          <div className="text-sm text-gray-600">
                            {item.quantity} {item.products?.unit} × ${item.unit_price.toFixed(2)}
                          </div>
                        </div>
                        <div className="font-medium">
                          ${(item.quantity * item.unit_price).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total</span>
                      <span>${Number(selectedOrder.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Update */}
                {selectedOrder.status !== 'delivered' && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-900 mb-3">Update Status</h3>
                    <button
                      onClick={() => {
                        updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status || 'confirmed'));
                        setSelectedOrder(null);
                      }}
                      className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap font-medium"
                    >
                      {getStatusAction(selectedOrder.status || 'confirmed')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}