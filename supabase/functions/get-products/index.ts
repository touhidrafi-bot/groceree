import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 🔓 Public anon client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
        },
      }
    );

    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const onSale = url.searchParams.get("onSale");
    const tags = url.searchParams.get("tags");

    let query = supabaseClient
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (category && category !== "All") {
      query = query.eq("department", category);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,department.ilike.%${search}%`
      );
    }

    const { data: products, error } = await query;
    if (error) throw error;

    const transformedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      weight: product.unit,
      price: product.price,
      originalPrice: product.original_price || null,
      bottle_price: product.bottle_price || 0,
      images: product.images || [],
      image:
        product.images?.[0] ??
        `https://readdy.ai/api/search-image?query=Professional product photography of ${product.name} on clean white background&width=400&height=300&seq=${product.id}`,
      category: product.department,
      description:
        product.description ||
        `Fresh ${product.name.toLowerCase()}, perfect for your daily needs.`,
      nutritionFacts:
        product.nutrition_facts || "Nutritional information available upon request.",
      tags: product.tags || [],
      isOnSale:
        product.original_price ? product.original_price > product.price : false,
      rating: 4.5 + Math.random() * 0.5,
      reviews: Math.floor(50 + Math.random() * 200),
      sku: product.sku,
      stock_quantity: product.stock_quantity,
      scalable: product.scalable,
      country_of_origin: product.country_of_origin,
      tax_type: product.tax_type,
      subdepartment: product.subdepartment,
    }));

    let filteredProducts = transformedProducts;

    if (onSale === "true") {
      filteredProducts = filteredProducts.filter((p) => p.isOnSale);
    }

    if (tags) {
      const tagArray = tags.split(",");
      filteredProducts = filteredProducts.filter((p) =>
        tagArray.some((tag) => p.tags.includes(tag))
      );
    }

    return new Response(JSON.stringify({ products: filteredProducts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
