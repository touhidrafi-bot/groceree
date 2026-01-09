'use client';

import { useState, useEffect } from 'react';
import { useCart } from './EnhancedCartProvider';
import { useAuth } from './AuthProvider';
import { SUPABASE_CONFIGURED } from '../lib/auth';
import {
  validatePostalCode,
  getNextAvailableDeliveryTime,
  PostalCodeValidation
} from '../lib/postal-code-validator';

export default function DeliveryEstimator() {
  const { deliveryInfo, updateDeliveryInfo } = useCart();
  const [postalCode, setPostalCode] = useState(deliveryInfo.postalCode);
  const [validation, setValidation] = useState<PostalCodeValidation | null>(null);
  const [deliveryTime, setDeliveryTime] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [cutoffTime, setCutoffTime] = useState('1:00 PM');

  const { isRehydrated, loading: authLoading } = useAuth();
  const authReady = isRehydrated && !authLoading;

  // Load cutoff time from delivery settings
  useEffect(() => {
    const loadCutoffTime = async () => {
      if (!SUPABASE_CONFIGURED) {
        console.warn('Supabase not configured; skipping cutoff time load in DeliveryEstimator.');
        return;
      }

      if (!authReady) return;

      try {
        const data = await fetch('/api/delivery/schedule').then(r => r.json());
        if (data && data.cutoff_time) {
          const [hour, minute] = data.cutoff_time.split(':').map(Number);
          const period = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          setCutoffTime(`${displayHour}:${minute.toString().padStart(2, '0')} ${period}`);
        }
      } catch (err) {
        console.error('Error loading cutoff time (DeliveryEstimator):', err && typeof err === 'object' ? JSON.stringify(err) : String(err));
      }
    };

    loadCutoffTime();
  }, [authReady]);

  // Live validation as user types
  useEffect(() => {
    if (!postalCode.trim()) {
      setValidation(null);
      setDeliveryTime(null);
      return;
    }

    setIsChecking(true);

    // Small delay to avoid excessive validation calls
    const timer = setTimeout(() => {
      const result = validatePostalCode(postalCode);
      setValidation(result);

      if (result.isLowerMainland) {
        // Note: cutoff time is already used by DeliveryScheduler component
        // This is just for UI display purposes
        const nextTime = getNextAvailableDeliveryTime();
        setDeliveryTime(nextTime);
      } else {
        setDeliveryTime(null);
      }

      setIsChecking(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [postalCode]);

  const handleConfirm = () => {
    if (validation && validation.isValid && validation.isLowerMainland) {
      const estimatedTime = deliveryTime
        ? `${deliveryTime.timeSlot} (${deliveryTime.date})`
        : 'Next available slot';

      updateDeliveryInfo({
        postalCode: validation.normalized,
        estimatedTime: estimatedTime,
        fee: 5.0
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validation?.isValid && validation?.isLowerMainland) {
      handleConfirm();
    }
  };

  const isDeliveryAvailable = validation?.isLowerMainland ?? false;
  const isValidInput = validation?.isValid ?? false;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center space-x-2 mb-6">
        <div className="w-5 h-5 flex items-center justify-center">
          <i className="ri-truck-line text-green-600"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Delivery Information</h3>
      </div>

      <div className="space-y-4">
        {/* Postal Code Input */}
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
              placeholder="e.g., A1A 1A1 or A1A1A1 or A1A-1A1"
              className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent text-sm transition-colors ${
                !postalCode
                  ? 'border-gray-300 focus:ring-green-500'
                  : isValidInput
                  ? isDeliveryAvailable
                    ? 'border-green-500 focus:ring-green-500 bg-green-50'
                    : 'border-red-500 focus:ring-red-500 bg-red-50'
                  : 'border-yellow-500 focus:ring-yellow-500 bg-yellow-50'
              }`}
              maxLength={7}
            />
            <button
              onClick={handleConfirm}
              disabled={!isValidInput || !isDeliveryAvailable || isChecking}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
            >
              {isChecking ? 'Checking...' : 'Confirm'}
            </button>
          </div>

          {/* Validation Message */}
          {postalCode && validation && (
            <div
              className={`mt-2 text-sm p-3 rounded-lg flex items-start space-x-2 ${
                isDeliveryAvailable
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                <i
                  className={`ri-${
                    isDeliveryAvailable ? 'check-circle' : 'alert-circle'
                  }-line text-lg`}
                ></i>
              </div>
              <span>{validation.message}</span>
            </div>
          )}

          {postalCode && !validation && isChecking && (
            <div className="mt-2 text-sm p-3 rounded-lg flex items-start space-x-2 bg-gray-50 text-gray-700">
              <div className="w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                <i className="ri-loader-4-line text-lg animate-spin"></i>
              </div>
              <span>Validating postal code...</span>
            </div>
          )}
        </div>

        {/* Delivery Status Section */}
        {isValidInput && (
          <div
            className={`rounded-lg p-4 ${
              isDeliveryAvailable ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i
                  className={`ri-${isDeliveryAvailable ? 'check-circle-fill' : 'close-circle-fill'} text-lg ${
                    isDeliveryAvailable ? 'text-green-600' : 'text-red-600'
                  }`}
                ></i>
              </div>
              <div className="flex-1">
                <h4
                  className={`font-semibold text-sm ${
                    isDeliveryAvailable ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {isDeliveryAvailable ? 'Delivery Available' : 'Delivery Not Available'}
                </h4>

                {isDeliveryAvailable && deliveryTime && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className={isDeliveryAvailable ? 'text-green-700' : 'text-red-700'}>
                        Estimated Time:
                      </span>
                      <span className={`font-semibold ${isDeliveryAvailable ? 'text-green-900' : 'text-red-900'}`}>
                        {deliveryTime.timeSlot}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={isDeliveryAvailable ? 'text-green-700' : 'text-red-700'}>
                        Delivery Date:
                      </span>
                      <span className={`font-semibold ${isDeliveryAvailable ? 'text-green-900' : 'text-red-900'}`}>
                        {deliveryTime.date}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-green-200">
                      <span className="text-green-700">Delivery Fee:</span>
                      <span className="font-semibold text-green-900">$5.00</span>
                    </div>
                  </div>
                )}

                {!isDeliveryAvailable && (
                  <p className="mt-2 text-sm text-red-700">
                    Unfortunately, we don't deliver to this postal code yet. Please check back soon or contact us for more information.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Current Delivery Info (if already set) */}
        {!postalCode && deliveryInfo.postalCode && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Current Postal Code:</span>
                <span className="font-semibold">{deliveryInfo.postalCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Estimated Delivery:</span>
                <span className="font-semibold text-green-600">{deliveryInfo.estimatedTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Delivery Fee:</span>
                <span className="font-semibold">${deliveryInfo.fee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Info Message */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>✓ Serving Vancouver,BC and nearby areas</p>
          <p>✓ Flat $5.00 delivery fee</p>
          <p>✓ Same-day delivery for orders before {cutoffTime}</p>
        </div>
      </div>
    </div>
  );
}
