import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '30';

    const supabase = await supabaseServer();

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

    if (ordersError) {
      console.error('Error loading orders for reports:', ordersError);
      return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
    }

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

      // Product sales
      order.order_items?.forEach((item: any) => {
        const productName = item.products?.name || 'Unknown';
        const quantity = item.quantity || 0;
        const revenue = quantity * (item.unit_price || 0);

        if (productSalesMap.has(productName)) {
          productSalesMap.set(productName, {
            name: productName,
            quantity: productSalesMap.get(productName).quantity + quantity,
            revenue: productSalesMap.get(productName).revenue + revenue
          });
        } else {
          productSalesMap.set(productName, { name: productName, quantity, revenue });
        }
      });

      // Order status
      const status = order.status || 'Unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);

      // Customer orders
      const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
      const customerName = customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown';
      customerOrdersMap.set(customerName, (customerOrdersMap.get(customerName) || 0) + 1);
    });

    const dailySales = Array.from(dailySalesMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const topProducts = Array.from(productSalesMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const ordersByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
    const topCustomers = Array.from(customerOrdersMap.entries()).map(([name, orders]) => ({ name, orders })).sort((a, b) => b.orders - a.orders).slice(0, 10);

    // Customer growth (simplified)
    const customerGrowth = [
      { month: 'Jan', customers: 10 },
      { month: 'Feb', customers: 15 },
      { month: 'Mar', customers: 20 }
    ];

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return NextResponse.json({
      dailySales,
      topProducts,
      ordersByStatus,
      customerGrowth,
      totalRevenue,
      totalOrders,
      averageOrderValue,
      topCustomers
    });
  } catch (error) {
    console.error('Error loading reports:', error);
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
  }
}