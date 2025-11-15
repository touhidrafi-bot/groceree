
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../components/EnhancedCartProvider';
import { useCartNotification } from '../../components/CartNotification';
import CartItem from './CartItem';
import DeliveryEstimator from '../../components/DeliveryEstimator';
import PromoCodeInput from '../../components/PromoCodeInput';
import CartNotification from '../../components/CartNotification';

export default function CartPage() {
  const { 
    items, 
    itemCount, 
    subtotal, 
    tax, 
    gst,
    pst,
    deliveryFee, 
    discount, 
    total, 
    deliveryInfo,
    appliedPromo,
    updateQuantity, 
    removeItem, 
    clearCart 
  } = useCart();
  
  const { notification, showNotification, hideNotification } = useCartNotification();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCart = async () => {
    setIsClearing(true);
    setTimeout(() => {
      clearCart();
      showNotification('Cart cleared successfully', 'info');
      setIsClearing(false);
    }, 500);
  };

  const handleQuantityUpdate = (id: string, newQuantity: number) => {
    const success = updateQuantity(id, newQuantity);
    if (!success && newQuantity > 0) {
      showNotification('Not enough stock available', 'error');
    }
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
    showNotification('Item removed from cart', 'info');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CartNotification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Shopping Cart</h1>
              <p className="text-gray-600">
                {itemCount > 0 
                  ? `${itemCount} item${itemCount > 1 ? 's' : ''} • Delivery in ${deliveryInfo.estimatedTime}`
                  : 'Your cart is empty'
                }
              </p>
            </div>
            {itemCount > 0 && (
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">${total.toFixed(2)}</div>
                  <div className="text-sm text-gray-500">Total (incl. tax)</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {itemCount === 0 ? (
          <div className="text-center py-16">
            <div className="w-32 h-32 flex items-center justify-center mx-auto mb-6 bg-gray-100 rounded-full">
              <i className="ri-shopping-cart-line text-6xl text-gray-400"></i>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your cart is empty</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Discover fresh, high-quality groceries and get them delivered to your door in Vancouver, BC!
            </p>
            <Link href="/products" className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap font-medium">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Cart Items ({itemCount})
                  </h2>
                  <button
                    onClick={handleClearCart}
                    disabled={isClearing}
                    className="text-red-600 hover:text-red-700 transition-colors cursor-pointer text-sm font-medium disabled:opacity-50"
                  >
                    {isClearing ? 'Clearing...' : 'Clear All'}
                  </button>
                </div>
                
                <div className="space-y-4">
                  {items.map((item) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      onUpdateQuantity={handleQuantityUpdate}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
              </div>

              {/* Continue Shopping */}
              <div className="flex justify-between items-center">
                <Link href="/products" className="text-green-600 hover:text-green-700 transition-colors cursor-pointer flex items-center font-medium">
                  <div className="w-5 h-5 flex items-center justify-center mr-2">
                    <i className="ri-arrow-left-line"></i>
                  </div>
                  Continue Shopping
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Delivery Estimator */}
                <DeliveryEstimator />

                {/* Order Summary */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Summary</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({itemCount} items)</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    
                    {discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({appliedPromo?.code})</span>
                        <span>-${discount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {gst > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>GST (5%)</span>
                        <span>${gst.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {pst > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>PST (7%)</span>
                        <span>${pst.toFixed(2)}</span>
                      </div>
                    )}
                    
                    {tax > 0 && (
                      <div className="flex justify-between text-gray-600 font-medium">
                        <span>Total Tax</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-gray-600">
                      <span>
                        Delivery Fee
                        {deliveryFee === 0 && (
                          <span className="text-green-600 text-sm ml-1">(Free!)</span>
                        )}
                      </span>
                      <span>${deliveryFee.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between text-lg font-semibold text-gray-900">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div className="mb-6">
                    <PromoCodeInput />
                  </div>

                  {/* Checkout Button */}
                  <Link
                    href="/checkout"
                    className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap text-center block font-medium text-lg"
                  >
                    Proceed to Checkout
                  </Link>

                  {/* Security & Delivery Info */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-4 h-4 flex items-center justify-center mr-1">
                          <i className="ri-shield-check-line"></i>
                        </div>
                        Secure Payment
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 flex items-center justify-center mr-1">
                          <i className="ri-truck-line"></i>
                        </div>
                        Same Day Delivery
                      </div>
                    </div>
                    
                    <div className="text-center text-xs text-gray-400">
                      <div className="flex items-center justify-center space-x-4">
                        <span>💳 Stripe</span>
                        <span>🅿️ PayPal</span>
                        <span>💰 Credit/Debit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
