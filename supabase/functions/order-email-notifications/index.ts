// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { orderId, emailType } = payload ?? {};

    console.log("📨 Email request:", payload);

    if (!orderId || !emailType) {
      return error("orderId and emailType are required", 400);
    }

    if (!["admin_new_order", "final_invoice"].includes(emailType)) {
      return error("Invalid emailType", 400);
    }

    // Env check
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const BREVO_KEY = Deno.env.get("BREVO_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_KEY || !BREVO_KEY) {
      console.error("❌ Missing env vars");
      return error("Server configuration error", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Fetch FINAL order state
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        total,
        subtotal,
        tax,
        delivery_fee,
        tip_amount,
        status,
        customer:users!orders_customer_id_fkey (
          first_name,
          last_name,
          email
        ),
        order_items (
          quantity,
          unit_price,
          total_price,
          final_weight,
          products (
            name,
            unit,
            scalable
          )
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("❌ Order fetch failed", orderError);
      return error("Order not found", 404);
    }

    // -----------------------
    // ADMIN NEW ORDER EMAIL
    // -----------------------
    if (emailType === "admin_new_order") {
      const res = await sendBrevo({
        to: "orders@groceree.ca", // change if needed
        subject: `🛒 New Order · #${order.order_number}`,
        html: adminEmail(order),
        apiKey: BREVO_KEY,
      });

      return ok(res);
    }

    // -----------------------
    // CUSTOMER FINAL INVOICE
    // -----------------------
    if (emailType === "final_invoice") {
      if (!order.customer?.email) {
        return error("Customer email missing", 400);
      }

      const res = await sendBrevo({
        to: order.customer.email,
        subject: `Your Final Invoice · Order #${order.order_number}`,
        html: customerInvoice(order),
        apiKey: BREVO_KEY,
      });

      return ok(res);
    }

    return error("Unhandled emailType", 500);
  } catch (err: any) {
    console.error("🔥 Email function crash:", err);
    return error(err.message ?? "Internal error", 500);
  }
});

/* ---------------- HELPERS ---------------- */

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ---------------- BREVO ---------------- */

async function sendBrevo({
  to,
  subject,
  html,
  apiKey,
}: any) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { email: "orders@groceree.ca", name: "Groceree" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    console.error("❌ Brevo error:", body);
    throw new Error(body.message ?? "Brevo send failed");
  }

  return body;
}

/* ---------------- EMAIL TEMPLATES ---------------- */

function adminEmail(order: any) {
  return `
    <h2>New Order Received</h2>
    <p><strong>Order:</strong> #${order.order_number}</p>
    <p><strong>Customer:</strong> ${order.customer.first_name} ${order.customer.last_name}</p>
    <p><strong>Estimated Total:</strong> $${order.total}</p>
    <p>
      <a href="https://admin.groceree.ca/orders/${order.id}">
        Open in Admin Dashboard
      </a>
    </p>
  `;
}

function customerInvoice(order: any) {
  const rows = order.order_items.map((i: any) => `
    <tr>
      <td>${i.products.name}</td>
      <td>${i.quantity}</td>
      <td>${i.products.scalable ? i.final_weight ?? "-" : "-"}</td>
      <td>$${Number(i.unit_price).toFixed(2)}</td>
      <td>$${Number(i.total_price).toFixed(2)}</td>
    </tr>
  `).join("");

  return `
    <h2>Your Final Invoice</h2>
    <p>Order #${order.order_number}</p>

    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Weight</th>
          <th>Unit</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p><strong>Subtotal:</strong> $${order.subtotal}</p>
    <p><strong>Tax:</strong> $${order.tax}</p>
    <p><strong>Delivery:</strong> $${order.delivery_fee}</p>
    <p><strong>Tip:</strong> $${order.tip_amount}</p>

    <h3>Final Total: $${order.total}</h3>

    <p>Thank you for shopping with Groceree 🥕</p>
  `;
}
