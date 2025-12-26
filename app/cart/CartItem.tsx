'use client';

import { useState } from 'react';

interface CartItemProps {
  item: {
    id: string;
    name: string;
    image: string;
    price: number;
    originalPrice?: number;
    quantity: number;
    unit: string;
    category: string;
    isOrganic?: boolean;
    inStock: number;
    sku: string;
    scalable?: boolean;
    bottle_price?: number;
  };
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export default function CartItem({ item, onUpdateQuantity, onRemove }: CartItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.quantity.toString());
  const [isRemoving, setIsRemoving] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Determine quantity step based on scalable property
  const getQuantityStep = (): number => {
    // Scalable products allow decimal increments (0.25)
    if (item.scalable) {
      return 0.25;
    }
    // Non-scalable products use whole number increments
    return 1;
  };

  const step = getQuantityStep();
  const isScalable = item.scalable || false;

  const increment = () => {
    const newQuantity = Math.round((item.quantity + step) * 100) / 100;
    onUpdateQuantity(item.id, newQuantity);
  };

  const decrement = () => {
    const newQuantity = Math.max(0, Math.round((item.quantity - step) * 100) / 100);
    onUpdateQuantity(item.id, newQuantity);
  };

  const handleEditSubmit = () => {
    const newQuantity = parseFloat(editValue);
    if (!isNaN(newQuantity) && newQuantity >= 0) {
      // Round to appropriate step based on scalable property
      const adjustedQuantity = isScalable 
        ? Math.round(newQuantity * 4) / 4  // Round to nearest 0.25 for scalable
        : Math.round(newQuantity);         // Round to whole number for non-scalable
      onUpdateQuantity(item.id, adjustedQuantity);
    } else {
      setEditValue(item.quantity.toString());
    }
    setIsEditing(false);
  };

  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSubmit();
    } else if (e.key === 'Escape') {
      setEditValue(item.quantity.toString());
      setIsEditing(false);
    }
  };

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onRemove(item.id);
    }, 200);
  };

  const isLowStock = item.inStock <= 5;
  const isOutOfStock = item.inStock === 0;

  const formatQuantity = (quantity: number): string => {
    if (isScalable) {
      return quantity % 1 === 0 ? quantity.toFixed(0) : quantity.toFixed(2);
    } else {
      return quantity.toFixed(0);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 border border-gray-100 rounded-lg hover:shadow-sm transition-all duration-200 ${isRemoving ? 'opacity-50 scale-95' : ''}`}>
      {/* Mobile: Image and Remove Button Row */}
      <div className="flex items-start justify-between sm:hidden">
        <div className="flex-shrink-0 relative">
          {imageError ? (
            <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
              <i className="ri-image-line text-2xl text-gray-400"></i>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.image}
              alt={item.name}
              className="w-16 h-16 object-cover object-top rounded-lg"
              onError={() => setImageError(true)}
            />
          )}
          {item.isOrganic && (
            <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              Organic
            </div>
          )}
          {item.originalPrice && (
            <div className="absolute -top-1 -left-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              Sale
            </div>
          )}
          {isScalable && (
            <div className="absolute -bottom-2 -left-2 bg-blue-500 text-white text-[10px] px-1 py-0.5 rounded-md shadow-sm">
              By Weight
            </div>
          )}
        </div>

        <button
          onClick={handleRemove}
          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          title="Remove item"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-delete-bin-line"></i>
          </div>
        </button>
      </div>

      {/* Desktop: Image */}
      <div className="hidden sm:block flex-shrink-0 relative">
        {imageError ? (
          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
            <i className="ri-image-line text-2xl text-gray-400"></i>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.image}
            alt={item.name}
            className="w-20 h-20 object-cover object-top rounded-lg"
            onError={() => setImageError(true)}
          />
        )}
        {item.isOrganic && (
          <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            Organic
          </div>
        )}
        {item.originalPrice && (
          <div className="absolute -top-1 -left-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            Sale
          </div>
        )}
        {isScalable && (
          <div className="absolute -bottom-2 -left-2 bg-blue-500 text-white text-[10px] px-1 py-0.5 rounded-md shadow-sm">
            By Weight
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-medium text-gray-900 truncate">{item.name}</h3>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-sm text-gray-500">{item.category}</p>
          <span className="text-gray-300">•</span>
          <p className="text-sm text-gray-500">SKU: {item.sku}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div className="flex items-center space-x-1">
            <span className="text-lg font-semibold text-green-600">
              ${item.price.toFixed(2)}
            </span>
            {item.originalPrice && (
              <span className="text-sm text-gray-400 line-through">
                ${item.originalPrice.toFixed(2)}
              </span>
            )}
            <span className="text-sm text-gray-500">per {item.unit}</span>
          </div>
        </div>

        {/* Stock Status */}
        <div className="mt-2">
          {isOutOfStock ? (
            <span className="text-red-600 text-sm font-medium">Out of Stock</span>
          ) : isLowStock ? (
            <span className="text-orange-600 text-sm font-medium">Low Stock</span>
          ) : (
            <span className="text-green-600 text-sm">In Stock</span>
          )}
        </div>
      </div>

      {/* Mobile: Quantity and Price Row */}
      <div className="flex items-center justify-between sm:hidden">
        {/* Quantity Controls */}
        <div className="flex items-center border border-gray-200 rounded-lg">
          <button
            onClick={decrement}
            className="p-2 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={item.quantity <= 0 || isOutOfStock}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-subtract-line text-gray-600"></i>
            </div>
          </button>

          {isEditing ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleEditKeyPress}
              className="w-12 text-center py-2 border-0 focus:outline-none focus:ring-0 text-sm"
              step={step}
              min="0"
              max={item.inStock}
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditValue(item.quantity.toString());
              }}
              className="px-3 py-2 min-w-[3rem] text-center hover:bg-gray-50 transition-colors cursor-pointer text-sm"
              disabled={isOutOfStock}
            >
              {formatQuantity(item.quantity)}
            </button>
          )}

          <button
            onClick={increment}
            className="p-2 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={item.quantity >= item.inStock || isOutOfStock}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line text-gray-600"></i>
            </div>
          </button>
        </div>

        {/* Price */}
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {formatQuantity(item.quantity)} {item.unit}
          </p>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900 text-lg">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
            {item.bottle_price && item.bottle_price > 0 && (
              <p className="text-xs text-blue-600 font-medium">
                +${(item.bottle_price * item.quantity).toFixed(2)} bottle
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: Quantity Controls, Price & Remove */}
      <div className="hidden sm:flex items-center space-x-4">
        {/* Quantity Controls */}
        <div className="flex items-center border border-gray-200 rounded-lg">
          <button
            onClick={decrement}
            className="p-2 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={item.quantity <= 0 || isOutOfStock}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-subtract-line text-gray-600"></i>
            </div>
          </button>

          {isEditing ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleEditKeyPress}
              className="w-16 text-center py-2 border-0 focus:outline-none focus:ring-0"
              step={step}
              min="0"
              max={item.inStock}
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditValue(item.quantity.toString());
              }}
              className="px-4 py-2 min-w-[4rem] text-center hover:bg-gray-50 transition-colors cursor-pointer"
              disabled={isOutOfStock}
            >
              {formatQuantity(item.quantity)}
            </button>
          )}

          <button
            onClick={increment}
            className="p-2 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={item.quantity >= item.inStock || isOutOfStock}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-add-line text-gray-600"></i>
            </div>
          </button>
        </div>

        {/* Price & Remove */}
        <div className="text-right min-w-[5rem]">
          <p className="text-sm text-gray-500">
            {formatQuantity(item.quantity)} {item.unit}
          </p>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900 text-lg">
              ${(item.price * item.quantity).toFixed(2)}
            </p>
            {item.bottle_price && item.bottle_price > 0 && (
              <p className="text-xs text-blue-600 font-medium">
                +${(item.bottle_price * item.quantity).toFixed(2)} bottle
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleRemove}
          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          title="Remove item"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-delete-bin-line"></i>
          </div>
        </button>
      </div>
    </div>
  );
}
