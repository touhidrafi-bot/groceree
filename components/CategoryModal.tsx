'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const getAuthHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    headers['apikey'] = anonKey;
    // Provide an Authorization header as some functions require it
    headers['Authorization'] = `Bearer ${anonKey}`;
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

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CategoryModal({ isOpen, onClose }: CategoryModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch categories and product counts
  const fetchCategories = async () => {
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error('Supabase URL not configured');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-products`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
    } catch (error) {
      console.error('Error fetching categories:', error);
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
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Browse Categories</h2>
              <p className="text-gray-600 text-sm mt-1">Select a category to view products</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
            >
              <i className="ri-close-line text-2xl"></i>
            </button>
          </div>

          {/* Categories Grid */}
          <div className="p-6">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className="bg-gray-100 rounded-2xl p-6 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-16 mx-auto"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/products?category=${encodeURIComponent(category.name)}`}
                    className="group bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 hover:border-green-200 cursor-pointer block text-center"
                    onClick={onClose}
                  >
                    <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <i className={`${category.icon} text-xl`}></i>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm leading-tight line-clamp-2">
                      {category.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {category.count} {category.count === 1 ? 'item' : 'items'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
