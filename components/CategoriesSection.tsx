'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SUPABASE_CONFIGURED, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/auth';

const getAuthHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
    // Ensure Authorization header is present — some Edge Functions require it.
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  return headers;
};

interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}

export default function CategoriesSection() {
  const [categoriesState, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch categories and product counts from Supabase
  const fetchCategories = async () => {
    try {
      if (!SUPABASE_CONFIGURED || !SUPABASE_URL) {
        console.warn('Supabase not configured; skipping categories fetch and using fallback values.');
        throw new Error('Supabase not configured');
      }

      const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/get-products`;

      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const text = await response.text().catch(() => 'unable to read body');
        throw new Error(`HTTP error! status: ${response.status} body: ${text}`);
      }
      const result = await response.json();
      
      if (result.error) throw new Error(result.error);
      
      const products = result.products || [];
      
      // Count products by category
      const categoryMap = new Map<string, number>();
      products.forEach((product: any) => {
        const category = product.category;
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });

      // Define category icons and colors
      const categoryConfig: Record<string, { icon: string; color: string }> = {
        'Produce': { icon: 'ri-leaf-line', color: 'bg-green-100 text-green-600' },
        'Grocery (Non-Taxable)': { icon: 'ri-shopping-basket-line', color: 'bg-blue-100 text-blue-600' },
        'Dairy, Dairy Alternatives & Eggs': { icon: 'ri-cup-line', color: 'bg-yellow-100 text-yellow-600' },
        'Bakery': { icon: 'ri-cake-3-line', color: 'bg-orange-100 text-orange-600' },
        'Grocery (Taxable GST)': { icon: 'ri-shopping-cart-line', color: 'bg-purple-100 text-purple-600' },
        'Health & Beauty': { icon: 'ri-heart-pulse-line', color: 'bg-pink-100 text-pink-600' }
      };

      const categoriesData = Array.from(categoryMap.entries()).map(([name, count], index) => ({
        id: (index + 1).toString(),
        name,
        count: count as number,
        icon: categoryConfig[name]?.icon || 'ri-shopping-bag-line',
        color: categoryConfig[name]?.color || 'bg-gray-100 text-gray-600'
      }));

      setCategories(categoriesData);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching categories:', {
        message: errorMessage,
        code: error?.code || 'UNKNOWN'
      });
      // Fallback to default categories
      setCategories([
        { id: '1', name: 'Produce', icon: 'ri-leaf-line', count: 0, color: 'bg-green-100 text-green-600' },
        { id: '2', name: 'Grocery (Non-Taxable)', icon: 'ri-shopping-basket-line', count: 0, color: 'bg-blue-100 text-blue-600' },
        { id: '3', name: 'Dairy, Dairy Alternatives & Eggs', icon: 'ri-cup-line', count: 0, color: 'bg-yellow-100 text-yellow-600' },
        { id: '4', name: 'Bakery', icon: 'ri-cake-3-line', count: 0, color: 'bg-orange-100 text-orange-600' },
        { id: '5', name: 'Grocery (Taxable GST)', icon: 'ri-shopping-cart-line', count: 0, color: 'bg-purple-100 text-purple-600' },
        { id: '6', name: 'Health & Beauty', icon: 'ri-heart-pulse-line', count: 0, color: 'bg-pink-100 text-pink-600' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Shop by Category</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Browse our fresh selection of groceries organized by category
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-gray-100 rounded-2xl p-6 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Shop by Category</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Browse our fresh selection of groceries organized by category
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {categoriesState.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${encodeURIComponent(category.name)}`}
              className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-green-200 cursor-pointer"
            >
              <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <i className={`${category.icon} text-xl`}></i>
              </div>
              <h3 className="font-semibold text-gray-900 text-center mb-2 text-sm leading-tight">
                {category.name}
              </h3>
              <p className="text-xs text-gray-500 text-center">
                {category.count} {category.count === 1 ? 'item' : 'items'}
              </p>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            View All Products
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-right-line"></i>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
