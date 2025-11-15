
'use client';

import { useState } from 'react';
import { useCart } from './EnhancedCartProvider';

export default function DeliveryEstimator() {
  const { deliveryInfo, updateDeliveryInfo } = useCart();
  const [postalCode, setPostalCode] = useState(deliveryInfo.postalCode);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateDelivery = () => {
    if (postalCode.trim()) {
      setIsUpdating(true);
      setTimeout(() => {
        updateDeliveryInfo({
          postalCode: postalCode.trim().toUpperCase(),
          estimatedTime: deliveryInfo.estimatedTime,
          fee: deliveryInfo.fee
        });
        setIsUpdating(false);
      }, 500);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUpdateDelivery();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-truck-line text-green-600"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Delivery Information</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Postal Code
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter postal code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
              maxLength={7}
            />
            <button
              onClick={handleUpdateDelivery}
              disabled={!postalCode.trim() || isUpdating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
            >
              {isUpdating ? 'Updating...' : 'Update'}
            </button>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Estimated Delivery Time:</span>
            <span className="text-sm font-semibold text-green-600">
              {deliveryInfo.estimatedTime}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Delivery Fee:</span>
            <span className="text-sm font-semibold text-gray-900">
              ${deliveryInfo.fee.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <p>• Flat $5.00 delivery fee for all locations</p>
          <p>• Standard delivery time: 2-4 hours</p>
          <p>• Same-day delivery available</p>
        </div>
      </div>
    </div>
  );
}
