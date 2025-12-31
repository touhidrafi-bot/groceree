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

    // Accept both 'final_invoice' and 'customer_invoice' for backward compatibility
    if (emailType !== "final_invoice" && emailType !== "customer_invoice") {
      return error(`Invalid emailType: ${emailType}. Only 'final_invoice' or 'customer_invoice' is supported.`, 400);
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
  const subtotal = Number(order.subtotal || 0).toFixed(2);
  const tax = Number(order.tax || 0).toFixed(2);
  const deliveryFee = Number(order.delivery_fee || 0).toFixed(2);
  const tipAmount = Number(order.tip_amount || 0).toFixed(2);
  const total = Number(order.total || 0).toFixed(2);
  const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const itemsHTML = items.map((i: any, idx: number) => {
    const productName = i.products?.name || "Unknown Product";
    const quantity = i.quantity || 0;
    const weight = i.products?.scalable ? (i.final_weight ?? "-") : "-";
    const unitPrice = Number(i.unit_price || 0).toFixed(2);
    const totalPrice = Number(i.total_price || 0).toFixed(2);
    const bgColor = idx % 2 === 0 ? "background-color: #f9fafb;" : "";

    return `
      <tr style="${bgColor}">
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px;">${productName}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; text-align: center;">${quantity}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; text-align: center;">${weight}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #374151; font-size: 14px; text-align: right;">$${unitPrice}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">$${totalPrice}</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.6;
          color: #374151;
          background-color: #f3f4f6;
          margin: 0;
          padding: 0;
        }
        .container {
          background-color: #ffffff;
          max-width: 600px;
          margin: 20px auto;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          padding: 40px 30px;
          color: white;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 14px;
          opacity: 0.95;
        }
        .logo-text {
          display: inline-block;
          font-size: 24px;
          margin-right: 8px;
        }
        .content {
          padding: 40px 30px;
        }
        .order-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }
        .order-number {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .order-id {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
        .order-date {
          font-size: 13px;
          color: #6b7280;
          margin-top: 4px;
        }
        .status-badge {
          display: inline-block;
          background-color: #dcfce7;
          color: #166534;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 13px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .customer-info {
          background-color: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          font-size: 14px;
        }
        .customer-info p {
          margin: 6px 0;
          color: #374151;
        }
        .customer-info strong {
          color: #111827;
          display: block;
          margin-top: 12px;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .items-table thead tr {
          background-color: #f3f4f6;
          border-bottom: 2px solid #e5e7eb;
        }
        .items-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .items-table th:nth-child(2),
        .items-table th:nth-child(3),
        .items-table th:nth-child(4),
        .items-table th:nth-child(5) {
          text-align: right;
        }
        .summary {
          background-color: #f9fafb;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          font-size: 14px;
          border-bottom: 1px solid #e5e7eb;
        }
        .summary-row:last-child {
          border-bottom: none;
        }
        .summary-label {
          color: #6b7280;
          font-weight: 500;
        }
        .summary-amount {
          color: #374151;
          font-weight: 600;
        }
        .summary-row.total {
          padding: 16px 0;
          margin-top: 10px;
          padding-top: 16px;
          border-top: 2px solid #d1d5db;
          font-size: 16px;
        }
        .summary-row.total .summary-label {
          color: #111827;
          font-weight: 700;
          font-size: 18px;
        }
        .summary-row.total .summary-amount {
          color: #10b981;
          font-weight: 700;
          font-size: 20px;
        }
        .footer {
          background-color: #f9fafb;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
          font-size: 13px;
          color: #6b7280;
        }
        .footer-brand {
          font-weight: 700;
          color: #10b981;
          margin-bottom: 12px;
          font-size: 14px;
        }
        .footer p {
          margin: 4px 0;
        }
        .divider {
          height: 1px;
          background-color: #e5e7eb;
          margin: 20px 0;
        }
        @media only screen and (max-width: 600px) {
          .container {
            margin: 0;
            border-radius: 0;
          }
          .content {
            padding: 24px 16px;
          }
          .header {
            padding: 30px 16px;
          }
          .order-header {
            flex-direction: column;
          }
          .status-badge {
            margin-top: 12px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1><span class="logo-text">🥕</span>Groceree</h1>
          <p>Your Fresh Groceries Delivered</p>
        </div>

        <!-- Content -->
        <div class="content">
          <!-- Order Header -->
          <div class="order-header">
            <div>
              <div class="order-number">Order Number</div>
              <h2 class="order-id">#${order.order_number || "N/A"}</h2>
              <div class="order-date">Date: ${orderDate}</div>
            </div>
            <div style="text-align: right;">
              <div class="status-badge">Order Confirmed</div>
            </div>
          </div>

          <!-- Customer Information -->
          <div class="section">
            <div class="section-title">Delivery To</div>
            <div class="customer-info">
              <strong>${order.customer?.first_name || ""} ${order.customer?.last_name || ""}</strong>
              <p>${order.delivery_address || "No address provided"}</p>
              <strong style="margin-top: 12px;">Contact</strong>
              <p>${order.customer?.email || "N/A"}</p>
              <p>${order.customer?.phone || "N/A"}</p>
            </div>
          </div>

          <!-- Items Table -->
          <div class="section">
            <div class="section-title">Order Items</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Weight</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML || "<tr><td colspan='5' style='text-align: center; padding: 20px; color: #9ca3af;'>No items</td></tr>"}
              </tbody>
            </table>
          </div>

          <!-- Order Summary -->
          <div class="section">
            <div class="section-title">Order Summary</div>
            <div class="summary">
              <div class="summary-row">
                <span class="summary-label">Subtotal</span>
                <span class="summary-amount">$${subtotal}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Sales Tax</span>
                <span class="summary-amount">$${tax}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Delivery Fee</span>
                <span class="summary-amount">$${deliveryFee}</span>
              </div>
              ${Number(tipAmount) > 0 ? `
              <div class="summary-row">
                <span class="summary-label">Tip</span>
                <span class="summary-amount">$${tipAmount}</span>
              </div>
              ` : ""}
              <div class="summary-row total">
                <span class="summary-label">Total Amount</span>
                <span class="summary-amount">$${total}</span>
              </div>
            </div>
          </div>

          <!-- Thank You Message -->
          <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; color: #166534; font-size: 14px;">
              <strong>Thank you for your order!</strong><br>
              We appreciate your business. Your order has been confirmed and is being prepared for delivery.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div class="footer-brand">🥕 Groceree</div>
          <p>Fresh Groceries Delivered to Your Door</p>
          <p>Email: orders@groceree.ca</p>
          <div class="divider" style="margin: 12px 0;"></div>
          <p style="font-size: 12px; margin-top: 12px;">
            This is an automated message. Please do not reply to this email.<br>
            Questions? Visit our website or contact our support team.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
