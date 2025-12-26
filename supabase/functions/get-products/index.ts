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
    // 🔓 Public unauthenticated client - uses default environment variables
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
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

    const transformedProducts = products.map((product) => {
      // Ensure dietary_tags is always an array
      // Handle null, undefined, and string representations of arrays
      let dietaryTags: string[] = [];

      if (product.dietary_tags) {
        if (Array.isArray(product.dietary_tags)) {
          // Filter out any null/empty values from the array
          dietaryTags = (product.dietary_tags as any[])
            .filter(tag => tag && String(tag).trim().length > 0)
            .map(tag => String(tag).toLowerCase().trim());
        } else if (typeof product.dietary_tags === 'string') {
          // If it's a string (JSON array format or comma-separated)
          const trimmed = String(product.dietary_tags).trim();
          if (trimmed.startsWith('[')) {
            // JSON array format
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                dietaryTags = parsed
                  .filter(tag => tag && String(tag).trim().length > 0)
                  .map(tag => String(tag).toLowerCase().trim());
              }
            } catch {
              dietaryTags = [];
            }
          } else if (trimmed.length > 0) {
            // Comma-separated format
            dietaryTags = trimmed
              .split(',')
              .map(tag => String(tag).trim().toLowerCase())
              .filter(tag => tag.length > 0);
          }
        }
      }

      // Fallback to tags column if dietary_tags is empty
      let tagsFallback: string[] = [];
      if (dietaryTags.length === 0 && product.tags) {
        if (Array.isArray(product.tags)) {
          tagsFallback = (product.tags as any[])
            .filter(tag => tag && String(tag).trim().length > 0)
            .map(tag => String(tag).toLowerCase().trim());
        } else if (typeof product.tags === 'string') {
          const trimmed = String(product.tags).trim();
          if (trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                tagsFallback = parsed
                  .filter(tag => tag && String(tag).trim().length > 0)
                  .map(tag => String(tag).toLowerCase().trim());
              }
            } catch {
              tagsFallback = [];
            }
          } else if (trimmed.length > 0) {
            tagsFallback = trimmed
              .split(',')
              .map(tag => String(tag).trim().toLowerCase())
              .filter(tag => tag.length > 0);
          }
        }
      }

      const finalDietaryTags = dietaryTags.length > 0 ? dietaryTags : tagsFallback;

      return {
        id: product.id,
        name: product.name,
        weight: product.unit,
        price: product.price,
        originalPrice: product.original_price || product.regular_price || null,
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
        tags: finalDietaryTags,
        dietary_tags: finalDietaryTags,
        isOnSale: (() => {
          const regularPrice = product.original_price || product.regular_price;
          if (!regularPrice || regularPrice <= 0) return false;
          return Number(regularPrice) > Number(product.price);
        })(),
        rating: 4.5 + Math.random() * 0.5,
        reviews: Math.floor(50 + Math.random() * 200),
        sku: product.sku,
        stock_quantity: product.stock_quantity,
        scalable: product.scalable,
        country_of_origin: product.country_of_origin,
        tax_type: product.tax_type,
        subdepartment: product.subdepartment,
      };
    });

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
