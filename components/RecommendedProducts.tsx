'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from './EnhancedCartProvider';
import { SUPABASE_CONFIGURED } from '../lib/auth';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  unit: string;
  category: string;
  isOnSale: boolean;
  stock_quantity?: number;
  sku?: string;
  tax_type?: 'none' | 'gst' | 'gst_pst';
}

export default function RecommendedProducts() {
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Fetch products from Supabase
  const fetchProducts = async () => {
    try {
      if (!SUPABASE_CONFIGURED) {
        throw new Error('Supabase not configured');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-products`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) throw new Error(result.error);

      const allProducts = result.products || [];
      // Get random 8 products for recommendations
      const shuffled = allProducts.sort(() => 0.5 - Math.random());
      setProducts(shuffled.slice(0, 8));
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddToCart = (product: Product) => {
    const taxType: 'none' | 'gst' | 'gst_pst' =
      product.tax_type === 'gst' || product.tax_type === 'gst_pst' ? product.tax_type : 'none';

    const success = addItem({
      id: product.id,
      name: product.name,
      image: product.image,
      bottle_price: (product as any).bottlePrice ?? (product as any).bottle_price ?? 0,
      price: product.price,
      originalPrice: product.originalPrice,
      unit: product.unit,
      category: product.category,
      isOrganic: false,
      inStock: product.stock_quantity || 50,
      sku: product.sku || `SKU${product.id.padStart(3, '0')}`,
      taxType
    }, 1);

    if (success) {
      setNotification(`${product.name} added to cart!`);
    } else {
      setNotification(`${product.name} is out of stock!`);
    }
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Recommended for You</h2>
            <p className="text-gray-600">Fresh picks we think you'll love</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-xl mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-16 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Recommended for You</h2>
          <p className="text-gray-600">Fresh picks we think you'll love</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="relative mb-4 w-full aspect-square overflow-hidden rounded-xl">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {product.isOnSale && (
                  <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    Sale
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.unit}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-green-600">
                    ${product.price.toFixed(2)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-gray-400 line-through">
                      ${product.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleAddToCart(product)}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-shopping-cart-line"></i>
                  </div>
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-white text-green-600 px-8 py-3 rounded-lg border-2 border-green-600 hover:bg-green-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            View All Products
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-arrow-right-line"></i>
            </div>
          </Link>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 text-green-800 px-6 py-3 rounded-lg shadow-lg">
          {notification}
        </div>
      )}
    </section>
  );
}
