// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { orderId, emailType } = payload;

    if (!orderId || !emailType) {
      return jsonError("orderId and emailType required", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // fetch order with items + customer
    const { data: order } = await supabase
      .from("orders")
      .select(`
        *,
        customer:users!orders_customer_id_fkey (first_name, last_name, email, phone),
        order_items (
          id,
          quantity,
          unit_price,
          total_price,
          final_weight,
          products (name, unit, scalable)
        )
      `)
      .eq("id", orderId)
      .single();

    if (!order) return jsonError("Order not found", 404);

    if (emailType === "admin_new_order") {
      const res = await sendBrevo({
        to: "touhid.rafi@gmail.com",
        from: "orders@groceree.ca",
        from_name: "Groceree New Order",
        subject: `New Order · #${order.order_number}`,
        html: adminEmail(order)
      });

      return respond(res);
    }

    if (emailType === "customer_invoice") {
      const res = await sendBrevo({
        to: order.customer.email,
        from: "orders@groceree.ca",
        from_name: "Groceree",
        subject: `Your Final Invoice · Order #${order.order_number}`,
        html: customerInvoice(order)
      });

      return respond(res);
    }

    return jsonError("Invalid emailType", 400);

  } catch (e) {
    console.error(e);
    return jsonError("Internal server error", 500);
  }
});

// ---------------------------
// Email HTML builders
// ---------------------------
function adminEmail(order: any) {
  return `
    <h2>New Order Received</h2>
    <p>Order #${order.order_number}</p>
    <p>Customer: ${order.customer.first_name} ${order.customer.last_name}</p>
    <p>Total (estimated): $${order.total}</p>
    <p><a href="https://groceree-admin-dashboard-url/orders/${order.id}">
      View Order
    </a></p>
  `;
}

function customerInvoice(order: any) {
  const rows = order.order_items.map((item: any) => `
    <tr>
      <td>${item.products.name}</td>
      <td>${item.quantity}</td>
      <td>${item.final_weight ?? "-"}</td>
      <td>$${item.unit_price.toFixed(2)}</td>
      <td>$${item.total_price.toFixed(2)}</td>
    </tr>
  `).join("");

  return `
    <h2>Your Final Invoice</h2>
    <p>Order #${order.order_number}</p>

    <table border="1" cellpadding="6">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Final Weight</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p><strong>Final Total: $${order.total.toFixed(2)}</strong></p>
  `;
}

// ---------------------------
async function sendBrevo({ to, from, from_name, subject, html }: any) {
  const API_KEY = Deno.env.get("BREVO_API_KEY");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender: { email: from, name: from_name },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });

  const body = await response.json();
  return { success: response.ok, status: response.status, body };
}

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    status: data.success ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function jsonError(msg: string, code = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status: code,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}