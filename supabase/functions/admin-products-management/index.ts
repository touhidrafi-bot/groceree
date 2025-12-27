import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body only once
    let reqBody: any = {}
    const contentType = req.headers.get('content-type')

    if (contentType && contentType.includes('application/json')) {
      try {
        reqBody = await req.json()
      } catch (e) {
        console.error('Failed to parse JSON body:', e)
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { method, action, productData, productId, department } = reqBody

    console.log('Received request body:', { method, action, productData, productId, department })

    // Department to subdepartment mapping
    const departmentSubdepartments = {
      'Produce': ['Fresh Fruits', 'Fresh Vegetables', 'Organic Produce', 'Herbs & Seasonings'],
      'Grocery (Non-Taxable)': ['Canned Goods', 'Dry Goods', 'Condiments', 'Baking Supplies'],
      'Grocery': ['Pantry Staples', 'Cooking Essentials', 'International Foods', 'Specialty Items'],
      'Dairy, Dairy Alternatives & Eggs': ['Milk & Cream', 'Cheese', 'Yogurt', 'Plant-Based Alternatives', 'Eggs'],
      'Bakery': ['Fresh Bread', 'Pastries', 'Cakes & Desserts', 'Bagels & Muffins'],
      'Grocery (Taxable GST)': ['Snacks', 'Beverages', 'Candy & Chocolate', 'Ice Cream'],
      'Health & Beauty': ['Personal Care', 'Vitamins & Supplements', 'First Aid', 'Beauty Products']
    }

    // Tax type mapping
    const departmentTaxTypes = {
      'Produce': 'none',
      'Grocery (Non-Taxable)': 'none',
      'Grocery': 'gst_pst',
      'Dairy, Dairy Alternatives & Eggs': 'none',
      'Bakery': 'none',
      'Grocery (Taxable GST)': 'gst',
      'Health & Beauty': 'gst_pst'
    }

    // Generate unique SKU
    const generateSKU = async (department, subdepartment) => {
      const deptCode = department.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '')
      const subCode = subdepartment ? subdepartment.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : 'GEN'
      
      let attempts = 0
      while (attempts < 10) {
        const randomNum = Math.floor(100 + Math.random() * 900)
        const sku = `${deptCode}-${subCode}-${randomNum.toString().padStart(3, '0')}`
        
        const { data: existing } = await supabaseClient
          .from('products')
          .select('id')
          .eq('sku', sku)
          .single()
        
        if (!existing) {
          return sku
        }
        attempts++
      }
      
      // Fallback with timestamp
      const timestamp = Date.now().toString().slice(-4)
      return `${deptCode}-${subCode}-${timestamp}`
    }

    // Handle GET actions regardless of HTTP method
    if (action === 'getProducts') {
      const { data: products, error } = await supabaseClient
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return new Response(
        JSON.stringify({ products }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'getSubdepartments') {
      const subdepartments = departmentSubdepartments[department] || []

      return new Response(
        JSON.stringify({ subdepartments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle POST actions
    if (action === 'createProduct') {
      // Auto-assign tax type based on department
      const taxType = departmentTaxTypes[productData.department] || 'none'

      // Generate SKU
      const sku = await generateSKU(productData.department, productData.subdepartment)

      // Sanitize productData: avoid sending fields that may not exist in all deployments
      const sanitizedProductData = { ...productData };

      // Ensure dietary_tags is a proper array
      const dietaryTagsArray = Array.isArray(sanitizedProductData.dietary_tags)
        ? sanitizedProductData.dietary_tags.filter((tag: any) => tag && String(tag).trim().length > 0)
        : [];

      console.log('Creating product with data:', {
        name: sanitizedProductData.name,
        dietary_tags: dietaryTagsArray,
        regular_price: sanitizedProductData.regular_price,
        bottle_price: sanitizedProductData.bottle_price
      });

      const { data: product, error } = await supabaseClient
        .from('products')
        .insert({
          name: sanitizedProductData.name,
          sku,
          description: sanitizedProductData.description,
          price: sanitizedProductData.price,
          regular_price: sanitizedProductData.regular_price || null,
          bottle_price: sanitizedProductData.bottle_price || 0,
          department: sanitizedProductData.department,
          subdepartment: sanitizedProductData.subdepartment,
          scalable: sanitizedProductData.scalable || false,
          tax_type: taxType,
          category: productData.department,
          country_of_origin: sanitizedProductData.country_of_origin,
          unit: sanitizedProductData.unit,
          stock_quantity: productData.stock_quantity || 0,
          in_stock: productData.stock_quantity || 0,
          low_stock_threshold: sanitizedProductData.low_stock_threshold,
          images: sanitizedProductData.images,
          is_active: sanitizedProductData.is_active !== undefined ? sanitizedProductData.is_active : true,
          dietary_tags: dietaryTagsArray,
          tags: dietaryTagsArray,
        })
        .select()
        .single()

      if (error) {
        console.error('Insert error details:', { error, productData: sanitizedProductData })
        throw new Error(`Failed to insert product: ${error.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          product,
          message: `Product created successfully with SKU: ${sku}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'updateProduct') {
      // Auto-assign tax type based on department
      const taxType = departmentTaxTypes[productData.department] || 'none'
      // Sanitize productData for update as well
      const sanitizedProductData = { ...productData };

      // Ensure dietary_tags is a proper array
      const dietaryTagsArray = Array.isArray(sanitizedProductData.dietary_tags)
        ? sanitizedProductData.dietary_tags.filter((tag: any) => tag && String(tag).trim().length > 0)
        : [];

      console.log('Updating product with data:', {
        name: sanitizedProductData.name,
        dietary_tags: dietaryTagsArray,
        productId
      });

      const { data: product, error } = await supabaseClient
        .from('products')
        .update({
          name: sanitizedProductData.name,
          description: sanitizedProductData.description,
          price: sanitizedProductData.price,
          regular_price: sanitizedProductData.regular_price || null,
          bottle_price: sanitizedProductData.bottle_price || 0,
          department: sanitizedProductData.department,
          subdepartment: sanitizedProductData.subdepartment,
          scalable: sanitizedProductData.scalable || false,
          tax_type: taxType,
          category: productData.department,
          country_of_origin: sanitizedProductData.country_of_origin,
          unit: sanitizedProductData.unit,
          stock_quantity: productData.stock_quantity || 0,
          in_stock: productData.stock_quantity || 0,
          low_stock_threshold: sanitizedProductData.low_stock_threshold,
          images: sanitizedProductData.images,
          is_active: sanitizedProductData.is_active !== undefined ? sanitizedProductData.is_active : true,
          dietary_tags: dietaryTagsArray,
          tags: dietaryTagsArray,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single()

      if (error) {
        console.error('Update error details:', { error, productData: sanitizedProductData })
        throw new Error(`Failed to update product: ${error.message}`)
      }

      return new Response(
        JSON.stringify({
          success: true,
          product,
          message: 'Product updated successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'deleteProduct') {
      const { error } = await supabaseClient
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Product deleted successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('No matching action found. Returning invalid action error.')
    return new Response(
      JSON.stringify({ error: `Invalid action: received action="${action}", method="${method}"` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error in admin-products-management:', {
      message: errorMessage,
      error: error instanceof Error ? { name: error.name, stack: error.stack } : error
    })
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: 'Check the server logs for more information'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
