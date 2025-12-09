// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Basic validation + parse
    let payload: any;
    try {
      payload = await req.json();
    } catch (e) {
      console.error("Failed parsing JSON body:", e);
      return jsonError("Invalid JSON body", 400);
    }

    const orderId = payload.orderId ?? payload.order_id;
    const emailType = payload.emailType ?? payload.email_type;
    const manualTrigger = payload.manualTrigger ?? payload.manual_trigger ?? false;

    if (!orderId || !emailType) {
      return jsonError("orderId and emailType are required", 400);
    }

    // Build supabase client (Authorization header optional)
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
      return jsonError("Server config error", 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    // Fetch order
    const { data: order, error: orderError } = await supabase
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

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      return jsonError("Order not found", 404);
    }

    // Prepare email content
    const { subject, html } = buildEmail(emailType, order);
    if (!subject) {
      return jsonError("Invalid email type", 400);
    }

    // Send via Brevo (fetch)
    const brevoResult = await sendBrevo({
      to: order.customer?.email,
      from: "orders@groceree.ca",
      from_name: "Groceree",
      subject,
      html,
    });

    // Log to DB (best effort)
    try {
      const { error: logError } = await supabase.from("order_notifications").insert({
        order_id: orderId,
        notification_type: emailType,
        recipient_email: order.customer?.email,
        subject,
        content: html,
        status: brevoResult.success ? "sent" : "failed",
        sent_at: new Date().toISOString(),
        manual_trigger: manualTrigger,
      });
      if (logError) console.error("Log insertion error:", logError);
    } catch (e) {
      console.error("Failed logging notification:", e);
    }

    // Return Brevo response for debugging
    return new Response(JSON.stringify({
      success: brevoResult.success,
      brevoStatus: brevoResult.status,
      brevoBody: brevoResult.body,
    }), {
      status: brevoResult.success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Unhandled error:", err);
    return jsonError(err?.message ?? "Internal error", 500);
  }
});

// ---------- helpers ----------
function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEmail(emailType: string, order: any) {
  const customerName = `${order.customer?.first_name ?? ""} ${order.customer?.last_name ?? ""}`.trim();
  if (emailType === "payment_confirmation") {
    const subject = `Payment Confirmation - Order #${order.order_number} - Groceree`;
    const html = generatePaymentConfirmationEmail(order);
    return { subject, html };
  } else if (emailType === "delivery_confirmation") {
    const subject = `Delivery Confirmation - Order #${order.order_number} - Groceree`;
    const html = generateDeliveryConfirmationEmail(order);
    return { subject, html };
  }
  return { subject: "", html: "" };
}

// Replace with your full templates (kept concise for readability)
function generatePaymentConfirmationEmail(order: any) {
  // full HTML allowed; keep same as your original template if you want
  return `<div><h1>Payment confirmed for order #${order.order_number}</h1><p>Customer: ${order.customer?.first_name} ${order.customer?.last_name}</p></div>`;
}
function generateDeliveryConfirmationEmail(order: any) {
  return `<div><h1>Order #${order.order_number} delivered</h1><p>Thank you!</p></div>`;
}

// ---------- Brevo via fetch ----------
async function sendBrevo({ to, from, from_name, subject, html }: any) {
  const API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!API_KEY) {
    console.error("Missing BREVO_API_KEY env var");
    return { success: false, status: null, body: { error: "missing_api_key" } };
  }
  if (!to) {
    console.error("Missing recipient email");
    return { success: false, status: null, body: { error: "missing_recipient" } };
  }

  const payload = {
    sender: { email: from, name: from_name },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      console.error("Brevo responded non-OK:", res.status, body);
      return { success: false, status: res.status, body };
    }

    // Brevo returns e.g. { "messageId": "xxx", "message": "Email sent" } on success
    return { success: true, status: res.status, body };
  } catch (e) {
    console.error("Network/Fetch error to Brevo:", e);
    return { success: false, status: null, body: { error: e?.message ?? String(e) } };
  }
}
