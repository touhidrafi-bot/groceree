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

    console.log("📨 Email request:", { orderId, emailType });

    if (!orderId || !emailType) {
      return error("orderId and emailType are required", 400);
    }

    if (emailType !== "final_invoice") {
      return error(`Invalid emailType: ${emailType}. Only 'final_invoice' is supported.`, 400);
    }

    // Env check
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const BREVO_KEY = Deno.env.get("BREVO_API_KEY");

    if (!SUPABASE_URL) {
      console.error("❌ Missing SUPABASE_URL");
      return error("Missing SUPABASE_URL configuration", 500);
    }

    if (!SUPABASE_KEY) {
      console.error("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
      return error("Missing SUPABASE_SERVICE_ROLE_KEY configuration", 500);
    }

    if (!BREVO_KEY) {
      console.error("❌ Missing BREVO_API_KEY environment variable");
      return error("Email service not configured. Please set BREVO_API_KEY environment variable.", 500);
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
    // CUSTOMER FINAL INVOICE
    // -----------------------
    if (!order.customer?.email) {
      console.error("❌ Customer email is missing");
      return error("Customer email missing", 400);
    }

    try {
      console.log("🔄 Preparing customer invoice email for:", order.customer.email);
      const emailHtml = customerInvoice(order);
      console.log("✅ Invoice HTML generated, length:", emailHtml.length);

      const res = await sendBrevo({
        to: order.customer.email,
        subject: `Your Final Invoice · Order #${order.order_number}`,
        html: emailHtml,
        apiKey: BREVO_KEY,
      });

      console.log("✅ Invoice email sent successfully");
      return ok(res);
    } catch (err: any) {
      console.error("❌ Invoice email failed:", err.message);
      throw err;
    }
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("🔥 Email function error:", errorMsg);
    return error(errorMsg, 500);
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
  // Validate email
  if (!to || !to.includes("@")) {
    throw new Error(`Invalid recipient email: ${to}`);
  }

  if (!subject || !subject.trim()) {
    throw new Error("Email subject is required");
  }

  if (!html || !html.trim()) {
    throw new Error("Email content (HTML) is required");
  }

  try {
    console.log("📤 Sending email via Brevo to:", to);

    const requestBody = {
      sender: { email: "orders@groceree.ca", name: "Groceree" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    console.log("📋 Email request details:", {
      to,
      subject,
      htmlLength: html.length
    });

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    let body: any = {};
    try {
      body = await res.json();
    } catch (e) {
      console.error("❌ Failed to parse Brevo response as JSON");
      throw new Error(`Brevo API returned ${res.status}: ${res.statusText}`);
    }

    if (!res.ok) {
      console.error("❌ Brevo API error:", {
        status: res.status,
        statusText: res.statusText,
        response: body
      });
      const errorMsg = body.message || body.error || `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(`Brevo API error: ${errorMsg}`);
    }

    console.log("✅ Email sent successfully");
    return body;
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Email send failed:", errorMsg);
    throw err;
  }
}

/* ---------------- EMAIL TEMPLATES ---------------- */

function customerInvoice(order: any) {
  const items = order.order_items || [];

  const rows = items.map((i: any) => {
    const productName = i.products?.name || "Unknown Product";
    const quantity = i.quantity || 0;
    const weight = i.products?.scalable ? (i.final_weight ?? "-") : "-";
    const unitPrice = Number(i.unit_price || 0).toFixed(2);
    const totalPrice = Number(i.total_price || 0).toFixed(2);

    return `
      <tr>
        <td>${productName}</td>
        <td>${quantity}</td>
        <td>${weight}</td>
        <td>$${unitPrice}</td>
        <td>$${totalPrice}</td>
      </tr>
    `;
  }).join("");

  const subtotal = Number(order.subtotal || 0).toFixed(2);
  const tax = Number(order.tax || 0).toFixed(2);
  const deliveryFee = Number(order.delivery_fee || 0).toFixed(2);
  const tipAmount = Number(order.tip_amount || 0).toFixed(2);
  const total = Number(order.total || 0).toFixed(2);

  return `
    <h2>Your Final Invoice</h2>
    <p>Order #${order.order_number || "N/A"}</p>

    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Weight</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows || "<tr><td colspan='5'>No items</td></tr>"}</tbody>
    </table>

    <p><strong>Subtotal:</strong> $${subtotal}</p>
    <p><strong>Tax:</strong> $${tax}</p>
    <p><strong>Delivery:</strong> $${deliveryFee}</p>
    <p><strong>Tip:</strong> $${tipAmount}</p>

    <h3>Final Total: $${total}</h3>

    <p>Thank you for shopping with Groceree 🥕</p>
  `;
}
