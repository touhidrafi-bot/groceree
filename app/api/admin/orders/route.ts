import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

export async function GET() {
  try {
    const supabase = await supabaseServer();

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
        product_id,
        quantity,
        unit_price,
        total_price,
        final_weight,
        bottle_price,
        products(id, name, unit, scalable, tax_type, stock_quantity, price, bottle_price)
      )
    `;

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
      return NextResponse.json([]);
    }

    const formattedOrders = (data || []).map((order: any) => {
      const orderItems = (order.order_items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        final_price: item.total_price,
        final_weight: item.final_weight,
        bottle_price: item.bottle_price,
        products: Array.isArray(item.products) ? item.products[0] : item.products
      }));

      return {
        ...order,
        order_items: orderItems,
        discount: order.discount ?? 0,
        tip_amount: order.tip_amount ?? 0,
        customer: Array.isArray(order.customer) ? order.customer[0] : order.customer,
        driver: Array.isArray(order.driver) ? order.driver[0] : order.driver
      };
    });

    return NextResponse.json(formattedOrders);
  } catch (err) {
    const message = (err as any)?.message || String(err);
    const details = (err as any)?.details || null;
    console.error('Unexpected error loading admin orders:', { message, details });
    return NextResponse.json([]);
  }
}