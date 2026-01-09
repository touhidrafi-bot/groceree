// supabase/functions/mark-stale-orders/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Orders older than 30 minutes with no payment
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "failed",
      status: "payment_abandoned"
    })
    .lte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .eq("payment_status", "pending_payment");

  if (error) {
    console.error("Failed to mark stale orders:", error);
    return new Response("Error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
