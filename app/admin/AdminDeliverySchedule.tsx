'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/auth';
import { useAuth } from '../../components/AuthProvider';

interface DeliverySettings {
  id: string;
  cutoff_time: string | null;
  max_deliveries_per_slot: number | null;
  default_slot_capacity: number | null;
  next_day_slots: any; // Json type
  same_day_slots: any; // Json type
  created_at: string | null;
  updated_at: string | null;
}

interface DeliveryWindow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  display_name: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  max_deliveries: number | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ScheduledDelivery {
  id: string;
  order_number: string;
  delivery_date: string;
  delivery_time_slot: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  status: string;
  total: number;
  created_at: string;
}

export default function AdminDeliverySchedule() {
  const { user, isRehydrated, loading: authLoading } = useAuth();
  const authReady = isRehydrated && !authLoading;
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [windows, setWindows] = useState<DeliveryWindow[]>([]);
  const [deliveries, setDeliveries] = useState<ScheduledDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [editingWindow, setEditingWindow] = useState<DeliveryWindow | null>(null);
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    // Abort any previous requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (authReady && user && user.role === 'admin') {
      loadData();
      setSelectedDate(new Date().toISOString().split('T')[0]);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [authReady, user]);

  const loadData = async () => {
    if (!authReady) return;

    setLoading(true);
    try {
      await Promise.all([loadSettings(), loadWindows(), loadScheduledDeliveries()]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      console.error('Error loading data:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    const query = supabase.from('delivery_settings').select('*');
    if (abortControllerRef.current?.signal) {
      query.abortSignal(abortControllerRef.current.signal);
    }
    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading settings:', error);
      return;
    }

    if (data) {
      setSettings(data);
    }
  };

  const loadWindows = async () => {
    const query = supabase
      .from('delivery_windows')
      .select('*')
      .order('start_time', { ascending: true });
    if (abortControllerRef.current?.signal) {
      query.abortSignal(abortControllerRef.current.signal);
    }
    const { data, error } = await query;

    if (error) {
      console.error('Error loading windows:', error);
      return;
    }

    setWindows(data || []);
  };

  const loadScheduledDeliveries = async () => {
    const query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        delivery_date,
        delivery_time_slot,
        delivery_address,
        status,
        total,
        created_at,
        customer:users!orders_customer_id_fkey(first_name, last_name, phone)
      `)
      .not('delivery_date', 'is', null)
      .order('delivery_date', { ascending: true })
      .order('delivery_time_slot', { ascending: true });
    if (abortControllerRef.current?.signal) {
      query.abortSignal(abortControllerRef.current.signal);
    }
    const { data, error } = await query;

    if (error) {
      console.error('Error loading scheduled deliveries:', error);
      return;
    }

    const formattedDeliveries = data?.map((order: any) => {
      const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
      return {
        id: order.id,
        order_number: order.order_number,
        delivery_date: order.delivery_date,
        delivery_time_slot: order.delivery_time_slot,
        customer_name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
        customer_phone: customer?.phone || '',
        delivery_address: order.delivery_address,
        status: order.status,
        total: order.total,
        created_at: order.created_at
      };
    }) || [];

    setDeliveries(formattedDeliveries);
  };

  const updateSettings = async (newSettings: Partial<DeliverySettings>) => {
  if (!settings) return;

  // REMOVE invalid time fields before sending to DB
  const cleaned = { ...newSettings };

  if (cleaned.cutoff_time === "") {
    delete cleaned.cutoff_time;
  }

  // Normalize cutoff_time to include seconds if browser returns HH:MM
  if (cleaned.cutoff_time && typeof cleaned.cutoff_time === 'string') {
    const parts = cleaned.cutoff_time.split(':');
    if (parts.length === 2) {
      // Add seconds component
      cleaned.cutoff_time = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    }
  }

  try {
    const { error } = await supabase
      .from('delivery_settings')
      .update(cleaned)
      .eq('id', settings.id);

    if (error) {
      console.error('Supabase error updating settings:', error);
      throw new Error(error.message);
    }

    setSettings({ ...settings, ...cleaned });
  } catch (error) {
    let errorMessage = 'Error updating settings';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      errorMessage = (error as any).message;
    } else {
      errorMessage = String(error);
    }
    console.error('Error updating settings:', errorMessage);
    alert(`Error updating settings: ${errorMessage}`);
  }
};


  const saveWindow = async (windowData: {
    name: string;
    start_time: string;
    end_time: string;
    display_name: string | null;
    max_deliveries: number | null;
    is_active: boolean | null;
    sort_order: number | null;
  }) => {
    try {
      if (editingWindow) {
        const { error } = await supabase.from('delivery_windows').update(windowData).eq('id', editingWindow.id);
        if (error) throw new Error(error.message || 'Failed to update time window');
      } else {
        const { error } = await supabase.from('delivery_windows').insert(windowData);
        if (error) throw new Error(error.message || 'Failed to create time window');
      }
      await loadWindows();
      setShowWindowModal(false);
      setEditingWindow(null);
    } catch (error) {
      let errorMessage = 'Failed to save time window';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }
      console.error('Error saving window:', errorMessage);
      alert(`Error saving time window: ${errorMessage}`);
    }
  };

  const deleteWindow = async (id: string) => {
    try {
      const { error } = await supabase.from('delivery_windows').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Failed to delete time window');
      await loadWindows();
    } catch (error) {
      let errorMessage = 'Failed to delete time window';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }
      console.error('Error deleting window:', errorMessage);
      alert(`Error deleting time window: ${errorMessage}`);
    }
  };

  const toggleWindowStatus = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('delivery_windows').update({ is_active: !isActive }).eq('id', id);
      if (error) throw new Error(error.message || 'Failed to update window status');
      await loadWindows();
    } catch (error) {
      let errorMessage = 'Failed to update window status';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }
      console.error('Error toggling window status:', errorMessage);
      alert(`Error updating window status: ${errorMessage}`);
    }
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
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

  const filteredDeliveries = deliveries.filter(delivery => !selectedDate || delivery.delivery_date === selectedDate);

  const getDeliveryCount = (date: string, timeSlot: string) => {
    return deliveries.filter(d => d.delivery_date === date && d.delivery_time_slot === timeSlot && d.status !== 'cancelled')
      .length;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-user-line text-4xl text-gray-400"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-user-line text-4xl text-gray-400"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">You need admin privileges to access this page</p>
        </div>
      </div>
    );
  }

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
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Delivery Schedule Management</h1>
        <p className="text-sm md:text-base text-gray-600">Manage delivery settings, time windows, and scheduled deliveries</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Settings
          </button>
          <button
            onClick={() => setActiveTab('windows')}
            className={`px-4 py-3 text-sm font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'windows'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Time Windows
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-4 py-3 text-sm font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'deliveries'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Scheduled Deliveries
          </button>
        </div>

        <div className="p-6">
          {/* Settings Tab */}
          {activeTab === 'settings' && settings && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Same-Day Delivery Cutoff Time
                  </label>
                  <input
                    type="time"
                    value={settings?.cutoff_time || ''}
                    onChange={e => updateSettings({ cutoff_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-5 mt-1">
                    Orders placed before this time can select same-day delivery
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Time Windows Tab */}
          {activeTab === 'windows' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Delivery Time Windows</h3>
                <button
                  onClick={() => {
                    setEditingWindow(null);
                    setShowWindowModal(true);
                  }}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 cursor-pointer whitespace-nowrap"
                >
                  Add Time Window
                </button>
              </div>

              <div className="space-y-3">
                {windows.map(window => (
                  <div key={window.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium text-gray-900">{window.display_name}</div>
                        <div className="text-sm text-gray-500">
                          {formatTime(window.start_time)} - {formatTime(window.end_time)}
                        </div>
                      </div>
                      <div
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          window.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {window.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleWindowStatus(window.id, window.is_active ?? false)}
                        className="text-blue-600 hover:text-blue-800 cursor-pointer whitespace-nowrap"
                      >
                        {window.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingWindow(window);
                          setShowWindowModal(true);
                        }}
                        className="text-green-600 hover:text-green-800 cursor-pointer whitespace-nowrap"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteWindow(window.id)}
                        className="text-red-600 hover:text-red-800 cursor-pointer whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Deliveries Tab */}
          {activeTab === 'deliveries' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Scheduled Deliveries</h3>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Filter by date:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Delivery Capacity Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {windows.filter(w => w.is_active).map(window => {
                  const count = getDeliveryCount(selectedDate, `${window.start_time.slice(0, 5)}-${window.end_time.slice(0, 5)}`);
                  const maxCapacity = window.max_deliveries || settings?.max_deliveries_per_slot || 15;
                  const percentage = (count / maxCapacity) * 100;
                  return (
                    <div key={window.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-900">{window.display_name}</div>
                      <div className="text-xs text-gray-500 mb-2">
                        {count}/{maxCapacity} deliveries scheduled
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            percentage >= 100 ? 'bg-red-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Deliveries Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Order
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Delivery Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Address
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredDeliveries.map(delivery => (
                        <tr key={delivery.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">#{delivery.order_number}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(delivery.created_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{delivery.customer_name}</div>
                            <div className="text-xs text-gray-500">{delivery.customer_phone}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(delivery.delivery_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            <div className="text-xs text-gray-500">
                              {delivery.delivery_time_slot
                                .split('-')
                                .map(time => {
                                  const [hours, minutes] = time.split(':');
                                  const hour = parseInt(hours);
                                  const ampm = hour >= 12 ? 'PM' : 'AM';
                                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                                  return `${displayHour}:${minutes} ${ampm}`;
                                })
                                .join(' - ')}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">{delivery.delivery_address}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                delivery.status
                              )}`}
                            >
                              {delivery.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${typeof delivery.total === 'number' ? delivery.total.toFixed(2) : parseFloat(delivery.total).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredDeliveries.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No scheduled deliveries found for the selected date
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time Window Modal */}
      {showWindowModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingWindow ? 'Edit Time Window' : 'Add Time Window'}
                </h2>
                <button
                  onClick={() => setShowWindowModal(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className="ri-close-line text-xl"></i>
                  </div>
                </button>
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const windowData = {
                    name: formData.get('name') as string,
                    start_time: formData.get('start_time') as string,
                    end_time: formData.get('end_time') as string,
                    display_name: formData.get('display_name') as string,
                    max_deliveries: parseInt(formData.get('max_deliveries') as string) || settings?.max_deliveries_per_slot || 15,
                    is_active: true,
                    sort_order: windows.length + 1,
                  };
                  saveWindow(windowData);
                }}
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Window Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingWindow?.name || ''}
                      placeholder="e.g., morning, afternoon, evening"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                    <input
                      type="text"
                      name="display_name"
                      defaultValue={editingWindow?.display_name || ''}
                      placeholder="e.g., 11:00 AM - 3:00 PM"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                      <input
                        type="time"
                        name="start_time"
                        defaultValue={editingWindow?.start_time || ''}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                      <input
                        type="time"
                        name="end_time"
                        defaultValue={editingWindow?.end_time || ''}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Deliveries for This Slot
                    </label>
                    <input
                      type="number"
                      name="max_deliveries"
                      min="1"
                      max="100"
                      defaultValue={editingWindow?.max_deliveries || settings?.max_deliveries_per_slot || 15}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Set the maximum number of deliveries allowed for this specific time slot
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowWindowModal(false)}
                    className="flex-1 px-4 py-2 text-gray-7 bg-gray-100 rounded-lg hover:bg-gray-200 cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer whitespace-nowrap"
                  >
                    {editingWindow ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
