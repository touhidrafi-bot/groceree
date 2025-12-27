// Refactored ProductQuickView with quantity synced to cart + bubble animations
'use client';

import { Product } from './ProductsContent';
import { useState, useEffect } from 'react';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/auth';
import Image from 'next/image';

interface ProductQuickViewProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, quantity?: number) => void;
  relatedProducts: Product[];
  initialQuantity?: number; // NEW
}

export default function ProductQuickView({
  product,
  onClose,
  onAddToCart,
  relatedProducts,
  initialQuantity = 1,
}: ProductQuickViewProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [addAnim, setAddAnim] = useState(false);
  const [subAnim, setSubAnim] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  // Sync with cart if it changes
  useEffect(() => {
    setQuantity(initialQuantity);
  }, [initialQuantity]);

  // Prefer uploaded product images (support up to 6). Fall back to `product.image` and a placeholder.
  const rawImages: any[] = [];
  if (Array.isArray((product as any).images) && (product as any).images.length > 0) {
    rawImages.push(...(product as any).images);
  }
  if (product.image) rawImages.push(product.image);

  // Normalize entries: allow strings or objects like { url } / { publicUrl } / { path }
  const normalizeEntry = (entry: any): string | null => {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object') {
      if (entry.url) return entry.url;
      if (entry.publicUrl) return entry.publicUrl;
      if (entry.path) return entry.path;
      if (entry.src) return entry.src;
    }
    return null;
  };

  // Remove falsy and duplicate values, then limit to 6 images
  const initialImages = Array.from(new Set(rawImages.map(normalizeEntry).filter(Boolean) as string[])).slice(0, 6);

  // Make images reactive so we can fetch missing images when needed
  const [galleryImages, setGalleryImages] = useState<string[]>(initialImages.length > 0 ? initialImages : ['/placeholder-product.jpg']);

  // Update gallery images when product.images changes
  useEffect(() => {
    if (Array.isArray((product as any).images) && (product as any).images.length > 0) {
      const normalized = Array.from(new Set((product as any).images.map(normalizeEntry).filter(Boolean) as string[])).slice(0, 6);
      if (normalized.length > 0) {
        setGalleryImages(normalized);
      }
    }
  }, [product.id, (product as any).images?.length, (product as any).images?.[0]]);

  // Debug: log images when opening QuickView (development-time assistance)
  useEffect(() => {
    try {
      console.log('ProductQuickView - product.images raw:', (product as any).images);
      console.log('ProductQuickView - normalized images (initial):', initialImages);
      console.log('ProductQuickView - galleryImages (state):', galleryImages);
    } catch {
      // ignore
    }
  }, [galleryImages]);

  // If the product doesn't include a full `images` array (or only has one), try fetching the product record directly
  useEffect(() => {
    let mounted = true;

    const fetchProductImages = async () => {
      try {
        if (!SUPABASE_CONFIGURED) return;
        // Only fetch if we don't already have multiple images
        if (galleryImages.length > 1) return;

        const { data, error } = await supabase
          .from('products')
          .select('images')
          .eq('id', product.id)
          .single();

        if (error) {
          console.debug('Could not fetch product images:', error.message || error);
          return;
        }

        const fetched = (data?.images || []) as any[];
        const normalized = Array.from(new Set(fetched.map(normalizeEntry).filter(Boolean) as string[])).slice(0, 6);
        if (mounted && normalized.length > 0) {
          setGalleryImages(normalized);
        }
      } catch {
        // ignore fetch errors
      }
    };

    fetchProductImages();

    return () => { mounted = false };
  }, [product.id]);

  // Reset selected image if gallery changes and index is out of bounds
  useEffect(() => {
    if (selectedImage >= galleryImages.length) {
      setSelectedImage(0);
    }
  }, [galleryImages, selectedImage]);

  const triggerAddAnim = () => {
    setAddAnim(true);
    setTimeout(() => setAddAnim(false), 400);
  };

  const triggerSubAnim = () => {
    setSubAnim(true);
    setTimeout(() => setSubAnim(false), 400);
  };

  const handleAddToCart = () => {
    triggerAddAnim();
    onAddToCart(product, quantity);
    setTimeout(onClose, 450);
  };

  const isScalable = product.scalable || false; // NEW
  const step = isScalable ? 0.25 : 1; // NEW

  const isOutOfStock = (product.stock_quantity || 0) <= 0.5;
  const isLowStock = (product.stock_quantity || 0) > 0.5 && (product.stock_quantity || 0) <= 5;

  const inStockRelated = relatedProducts.filter((p) => (p.stock_quantity || 0) > 0.5);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-700" onClick={onClose}>
          <i className="ri-close-line text-2xl" />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Product Details</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* MAIN IMAGE */}
            <div>
              <div className="relative mb-4">
                <Image
                  src={galleryImages[selectedImage]}
                  alt={product.name}
                  width={600}
                  height={600}
                  className="w-full h-96 object-cover rounded-lg main-image-hover"
                />

                {product.isOnSale && (
                  <span className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm">
                    Sale
                  </span>
                )}

                {product.tags?.includes('organic') && (
                  <span className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                    Organic
                  </span>
                )}

                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg text-white text-xl font-semibold">
                    Out of Stock
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {galleryImages.map((img, i) => (
                  <button
                    key={i}
                    className={`w-20 h-20 overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                      selectedImage === i ? 'border-green-500' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedImage(i)}
                  >
                    <Image src={img} alt={product.name + i} width={80} height={80} className="object-cover w-full h-full thumbnail-hover" />
                  </button>
                ))}
              </div>
            </div>

            {/* PRODUCT INFO */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-gray-600 mb-2">{product.weight}</p>

              <div className="flex items-center gap-3 mt-2 mb-4">
                <span className="text-3xl font-bold text-green-600">${product.price.toFixed(2)}</span>
                {product.originalPrice && (
                  <span className="line-through text-gray-500 text-xl">${product.originalPrice.toFixed(2)}</span>
                )}
                {isLowStock && !isOutOfStock && (
                  <span className="text-orange-600 bg-orange-100 px-2 py-1 rounded text-sm">Low Stock</span>
                )}
              </div>

              <p className="text-gray-700 mb-6">{product.description}</p>

              {!isOutOfStock && (
                <div className="flex items-center gap-4 mb-6 relative">
                  {/* QUANTITY */}
                  <div className="flex items-center border border-gray-300 rounded-lg">
                    <button
                      onClick={() => {
                        if (quantity > step) {
                          triggerSubAnim();
                          setQuantity((q) => Number((q - step).toFixed(2)));
                        }
                      }}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-100"
                    >
                      <i className="ri-subtract-line" />
                    </button>

                    <span className="px-4 py-2 font-medium">{quantity.toFixed(2)}</span>

                    <button
                      onClick={() => {
                        triggerAddAnim();
                        setQuantity((q) => Number((q + step).toFixed(2)));
                      }}
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-100"
                    >
                      <i className="ri-add-line" />
                    </button>
                  </div>

                  {/* GREEN BUBBLE */}
                  {addAnim && (
                    <div className="absolute -top-6 left-24 bg-green-600 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm animate-bubble-up">
                      +{step}
                    </div>
                  )}

                  {/* RED BUBBLE */}
                  {subAnim && (
                    <div className="absolute -top-6 left-2 bg-red-600 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm animate-bubble-up">
                      -{step}
                    </div>
                  )}

                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <i className="ri-add-line" /> Add to Cart - ${(product.price * quantity).toFixed(2)}
                  </button>
                </div>
              )}

              <div className="border-t pt-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">SKU:</span>
                  <span>{product.sku}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Category:</span>
                  <span>{product.category}</span>
                </div>
                {product.country_of_origin && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Origin:</span>
                    <span>{product.country_of_origin}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RELATED PRODUCTS */}
          {inStockRelated.length > 0 && (
            <div className="mt-10 border-t pt-6">
              <h3 className="text-xl font-bold mb-4">You Might Also Like</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {inStockRelated.map((rp) => (
                  <div key={rp.id} className="cursor-pointer" onClick={onClose}>
                    <div className="rounded-lg overflow-hidden mb-2">
                      <Image src={rp.image} alt={rp.name} width={200} height={150} className="object-cover w-full h-32 related-image-hover" />
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{rp.name}</p>
                    <p className="text-green-600 font-bold text-sm">${rp.price.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .main-image-hover {
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          transform: scale(1);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .main-image-hover:hover {
          transform: scale(1.05) translateY(-4px);
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
        }

        .thumbnail-hover {
          transition: all 0.2s ease-in-out;
          transform: scale(1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .thumbnail-hover:hover {
          transform: scale(1.1) translateY(-2px);
          box-shadow: 0 8px 12px rgba(0, 0, 0, 0.2);
        }

        .related-image-hover {
          transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
          transform: scale(1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .related-image-hover:hover {
          transform: scale(1.08) translateY(-3px);
          box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15);
        }

        .animate-bubble-up {
          animation: bubbleUp 0.4s ease-out forwards;
        }

        @keyframes bubbleUp {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
