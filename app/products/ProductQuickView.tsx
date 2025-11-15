
'use client';

import { Product } from './ProductsContent';
import { useState } from 'react';

interface ProductQuickViewProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  relatedProducts: Product[];
}

export default function ProductQuickView({ product, onClose, onAddToCart, relatedProducts }: ProductQuickViewProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const images = [
    product.image,
    `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28product.name%29%7D%20detailed%20view%20professional%20product%20photography%20clean%20white%20background%20high%20quality%20commercial%20food%20photography%20style&width=600&height=600&seq=${product.id}2&orientation=squarish`,
    `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28product.name%29%7D%20ingredients%20nutrition%20label%20professional%20product%20photography%20clean%20white%20background%20high%20quality%20commercial%20food%20photography%20style&width=600&height=600&seq=${product.id}3&orientation=squarish`
  ];

  const handleAddToCart = () => {
    onAddToCart(product);
    onClose();
  };

  const isOutOfStock = (product.stock_quantity || 0) <= 0.5;
  const isLowStock = (product.stock_quantity || 0) > 0.5 && (product.stock_quantity || 0) <= 5;

  // Filter out-of-stock products from related products
  const inStockRelatedProducts = relatedProducts.filter(relatedProduct => 
    (relatedProduct.stock_quantity || 0) > 0.5
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Product Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-close-line text-2xl"></i>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Product Images */}
            <div>
              <div className="relative mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[selectedImage]}
                  alt={product.name}
                  className="w-full h-96 object-cover object-center rounded-lg"
                />
                {product.isOnSale && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Sale
                  </div>
                )}
                {product.tags?.includes('organic') && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Organic
                  </div>
                )}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <span className="text-white font-semibold text-xl">Out of Stock</span>
                  </div>
                )}
              </div>

              {/* Image Thumbnails */}
              <div className="flex gap-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 cursor-pointer ${
                      selectedImage === index ? 'border-green-500' : 'border-gray-200'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt={`${product.name} view ${index + 1}`}
                      className="w-full h-full object-cover object-center"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
                  <p className="text-gray-600 mb-2">{product.weight}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold text-green-600">${product.price.toFixed(2)}</span>
                {product.originalPrice && (
                  <span className="text-xl text-gray-500 line-through">${product.originalPrice.toFixed(2)}</span>
                )}
                {isLowStock && !isOutOfStock && (
                  <span className="text-sm text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded">
                    Low Stock
                  </span>
                )}
              </div>

              {/* Stock Status */}
              <div className="mb-4">
                {isOutOfStock ? (
                  <div className="text-red-600 font-medium">Out of Stock</div>
                ) : isLowStock ? (
                  <div className="text-orange-600 font-medium">Low Stock</div>
                ) : (
                  <div className="text-green-600 font-medium">In Stock</div>
                )}
              </div>

              <p className="text-gray-700 mb-6">{product.description}</p>

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Features</h3>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm capitalize"
                      >
                        {tag.replace('-', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity and Add to Cart */}
              {!isOutOfStock && (
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-subtract-line"></i>
                      </div>
                    </button>
                    <span className="px-4 py-2 font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-add-line"></i>
                      </div>
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium cursor-pointer whitespace-nowrap"
                  >
                    Add to Cart - ${(product.price * quantity).toFixed(2)}
                  </button>
                </div>
              )}

              {/* Product Details */}
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Product Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">SKU:</span>
                    <span className="font-medium">{product.sku}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category:</span>
                    <span className="font-medium">{product.category}</span>
                  </div>
                  {product.country_of_origin && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Origin:</span>
                      <span className="font-medium">{product.country_of_origin}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {inStockRelatedProducts && inStockRelatedProducts.length > 0 && (
            <div className="mt-12 border-t pt-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">You might also like</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {inStockRelatedProducts.map((relatedProduct) => (
                  <div key={relatedProduct.id} className="group cursor-pointer" onClick={() => onClose()}>
                    <div className="relative overflow-hidden rounded-lg mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={relatedProduct.image}
                        alt={relatedProduct.name}
                        className="w-full h-32 object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <h4 className="font-medium text-gray-900 text-sm mb-1 group-hover:text-green-600 transition-colors">
                      {relatedProduct.name}
                    </h4>
                    <p className="text-green-600 font-bold text-sm">${relatedProduct.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
