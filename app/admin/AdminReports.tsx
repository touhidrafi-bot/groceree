'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/auth';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface ReportData {
  dailySales: any[];
  topProducts: any[];
  ordersByStatus: any[];
  customerGrowth: any[];
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topCustomers: any[];
}

export default function AdminReports() {
  const [reportData, setReportData] = useState<ReportData>({
    dailySales: [],
    topProducts: [],
    ordersByStatus: [],
    customerGrowth: [],
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    topCustomers: []
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));

      // Load orders data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          subtotal,
          gst,
          pst,
          tax,
          delivery_fee,
          discount,
          tip_amount,
          total,
          order_items(
            quantity,
            unit_price,
            products(name, category)
          ),
          customer:users!orders_customer_id_fkey(first_name, last_name)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (ordersError) throw ordersError;

      // Process daily sales
      const dailySalesMap = new Map();
      const productSalesMap = new Map();
      const statusMap = new Map();
      const customerOrdersMap = new Map();
      
      let totalRevenue = 0;
      let totalOrders = orders?.length || 0;

      orders?.forEach(order => {
        const date = order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Unknown';
        // Calculate revenue from order components to ensure tip is included
        const revenue = Number(order.subtotal || 0) + Number(order.tax || 0) + Number(order.delivery_fee || 0) + Number(order.tip_amount || 0) - Number(order.discount || 0);

        totalRevenue += revenue;

        // Daily sales
        if (dailySalesMap.has(date)) {
          dailySalesMap.set(date, {
            date,
            revenue: dailySalesMap.get(date).revenue + revenue,
            orders: dailySalesMap.get(date).orders + 1
          });
        } else {
          dailySalesMap.set(date, { date, revenue, orders: 1 });
        }

        // Order status
        if (statusMap.has(order.status)) {
          statusMap.set(order.status, statusMap.get(order.status) + 1);
        } else {
          statusMap.set(order.status, 1);
        }

        // Customer orders
        const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
        const customerKey = `${customer?.first_name} ${customer?.last_name}`;
        if (customerOrdersMap.has(customerKey)) {
          customerOrdersMap.set(customerKey, {
            name: customerKey,
            orders: customerOrdersMap.get(customerKey).orders + 1,
            revenue: customerOrdersMap.get(customerKey).revenue + revenue
          });
        } else {
          customerOrdersMap.set(customerKey, {
            name: customerKey,
            orders: 1,
            revenue
          });
        }

        // Product sales
        order.order_items?.forEach((item: any) => {
          const products = Array.isArray(item.products) ? item.products[0] : item.products;
          const productName = products?.name;
          if (productName) {
            if (productSalesMap.has(productName)) {
              productSalesMap.set(productName, {
                name: productName,
                quantity: productSalesMap.get(productName).quantity + item.quantity,
                revenue: productSalesMap.get(productName).revenue + (item.quantity * item.unit_price)
              });
            } else {
              productSalesMap.set(productName, {
                name: productName,
                quantity: item.quantity,
                revenue: item.quantity * item.unit_price
              });
            }
          }
        });
      });

      const dailySales = Array.from(dailySalesMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const ordersByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
        status: status.replace('_', ' '),
        count
      }));

      const topCustomers = Array.from(customerOrdersMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setReportData({
        dailySales,
        topProducts,
        ordersByStatus,
        customerGrowth: [], // Would need user registration data
        totalRevenue,
        totalOrders,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topCustomers
      });

    } catch (error: any) {
      console.error('Error loading report data:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN'
      });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'];

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
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-gray-600">Analyze your business performance</p>
        </div>
        <div>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-money-dollar-circle-line text-white text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{reportData.totalOrders.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-file-list-line text-white text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Average Order Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${reportData.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-shopping-cart-line text-white text-xl"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Sales</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={reportData.dailySales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={reportData.ordersByStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count }) => `${status}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {reportData.ordersByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={reportData.topProducts.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h3>
          <div className="space-y-3">
            {reportData.topCustomers.slice(0, 5).map((customer, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-600">{customer.orders} orders</div>
                </div>
                <div className="text-lg font-bold text-green-600">
                  ${customer.revenue.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
