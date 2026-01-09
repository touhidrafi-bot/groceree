'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from '../../components/EnhancedCartProvider';
import { Product } from './ProductsContent';

interface ProductGridProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product & { quantity?: number }) => void;
}

interface ProductImageState {
  [key: string]: boolean;
}

export default function ProductGrid({ products, onProductClick, onAddToCart }: ProductGridProps) {
  const [imageErrors, setImageErrors] = useState<ProductImageState>({});
  const { items, updateQuantity } = useCart();

  const [animatingAdd, setAnimatingAdd] = useState<ProductImageState>({});
  const [animatingSubtract, setAnimatingSubtract] = useState<ProductImageState>({});

  const handleImageError = (productId: string) => {
    setImageErrors(prev => ({ ...prev, [productId]: true }));
  };

  const roundQty = (num: number) => Math.round(num * 100) / 100;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => {
        const cartItem = items.find(i => i.id === product.id);
        const qty = cartItem ? cartItem.quantity : 0;

        const step = product.scalable ? 0.25 : 1;

        const handleAdd = () => {
          onAddToCart({ ...product, quantity: step });
          setAnimatingAdd(prev => ({ ...prev, [product.id]: true }));
          setTimeout(() => setAnimatingAdd(prev => ({ ...prev, [product.id]: false })), 650);
        };

        const handleSubtract = () => {
          const newQty = roundQty(qty - step);
          updateQuantity(product.id, Math.max(0, newQty));

          setAnimatingSubtract(prev => ({ ...prev, [product.id]: true }));
          setTimeout(() => setAnimatingSubtract(prev => ({ ...prev, [product.id]: false })), 650);
        };

        return (
          <div
            key={product.id}
            className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
          >
            {/* Image */}
            <div className="relative overflow-hidden bg-gray-100">
              {imageErrors[product.id] ? (
                <div
                  className="w-full h-36 sm:h-48 bg-gray-200 flex items-center justify-center cursor-pointer"
                  onClick={() => onProductClick(product)}
                >
                  <i className="ri-image-line text-3xl sm:text-4xl text-gray-400"></i>
                </div>
              ) : (
                <div className="relative w-full h-36 sm:h-48">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover object-center transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                    onClick={() => onProductClick(product)}
                    onError={() => handleImageError(product.id)}
                  />
                </div>
              )}

              {/* Labels */}
              {product.isOnSale && (
                <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  Sale
                </div>
              )}

              {product.tags?.includes('organic') && (
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  Organic
                </div>
              )}

              {(product.stock_quantity || 0) <= 0.5 && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm sm:text-lg">Out of Stock</span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-3 sm:p-4">
              <h3
                className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight cursor-pointer hover:text-green-600 transition-colors mb-2"
                onClick={() => onProductClick(product)}
              >
                {product.name}
              </h3>

              <p className="text-xs text-gray-600 mb-2">{product.weight}</p>

              {/* Price */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-600 text-sm sm:text-base">${product.price.toFixed(2)}</span>
                  {product.originalPrice && (
                    <span className="text-xs sm:text-sm text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
                  )}
                </div>

                {(product.stock_quantity || 0) > 0.5 &&
                  (product.stock_quantity || 0) <= 5 && (
                    <span className="text-xs text-orange-600 font-medium">Low Stock</span>
                  )}
              </div>

              {/* CART BUTTONS */}
              {(product.stock_quantity || 0) > 0.5 ? (
                qty > 0 ? (
                  <div className="flex items-center justify-between gap-2 relative">
                    {/* Subtract */}
                    <div className="relative">
                      <button
                        onClick={handleSubtract}
                        className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <i className="ri-subtract-line text-lg text-gray-700"></i>
                      </button>

                      {/* Red subtract bubble */}
                      {animatingSubtract[product.id] && (
                        <div className="absolute -top-6 left-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs flying-bubble">
                          -{step}
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center font-medium">
                      {qty}
                    </div>

                    {/* Add */}
                    <div className="relative">
                      <button
                        onClick={handleAdd}
                        className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                      >
                        <i className="ri-add-line text-lg text-gray-700"></i>
                      </button>

                      {/* Green add bubble */}
                      {animatingAdd[product.id] && (
                        <div className="absolute -top-6 right-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs flying-bubble">
                          +1
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleAdd}
                    className="w-full bg-green-600 text-white py-2 px-2 sm:px-4 rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium"
                  >
                    Add to Cart
                  </button>
                )
              ) : (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium cursor-not-allowed"
                >
                  Out of Stock
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
