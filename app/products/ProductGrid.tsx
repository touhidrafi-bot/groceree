'use client';

import { Product } from './ProductsContent';

interface ProductGridProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

export default function ProductGrid({ products, onProductClick, onAddToCart }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => (
        <div key={product.id} className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300">
            <div className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-36 sm:h-48 object-cover object-center transition-transform duration-300 group-hover:scale-105 cursor-pointer"
              onClick={() => onProductClick(product)}
            />
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

          <div className="p-3 sm:p-4">
            <h3
              className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight cursor-pointer hover:text-green-600 transition-colors mb-2"
              onClick={() => onProductClick(product)}
            >
              {product.name}
            </h3>

            <p className="text-xs text-gray-600 mb-2">{product.weight}</p>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-600 text-sm sm:text-base">${product.price.toFixed(2)}</span>
                {product.originalPrice && (
                  <span className="text-xs sm:text-sm text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
                )}
              </div>
              {(product.stock_quantity || 0) > 0.5 && (product.stock_quantity || 0) <= 5 && (
                <span className="text-xs text-orange-600 font-medium">Low Stock</span>
              )}
            </div>

            {(product.stock_quantity || 0) > 0.5 ? (
              <button
                onClick={() => onAddToCart(product)}
                className="w-full bg-green-600 text-white py-2 px-2 sm:px-4 rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap"
              >
                Add to Cart
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-500 py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-medium cursor-not-allowed whitespace-nowrap"
              >
                Out of Stock
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
