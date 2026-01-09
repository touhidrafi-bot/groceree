'use client';

import { useEffect, useState } from 'react';
import { useCart } from './EnhancedCartProvider';
import { useCartNotification } from './CartNotification';
import { useAuth } from './AuthProvider';
import type { PromoCode as PromoCodeType } from '../lib/cart-store';

export default function PromoCodeInput() {
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [availablePromos, setAvailablePromos] = useState<PromoCodeType[]>([]);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);

  const { applyPromoCode, removePromoCode, appliedPromo } = useCart();
  const { showNotification } = useCartNotification();
  const { isRehydrated, loading: authLoading } = useAuth();
  const authReady = isRehydrated && !authLoading;

  useEffect(() => {
    let isMounted = true;
    const fetchPromos = async () => {
      if (!authReady) return;

      try {
        setIsSuggestLoading(true);
        const promos = await fetch('/api/promo/list').then(r => r.json());
        if (isMounted) setAvailablePromos(promos || []);
      } catch {
          // no-op; suggestions are optional
        } finally {
        if (isMounted) setIsSuggestLoading(false);
      }
    };

    if (!appliedPromo) fetchPromos();
    return () => {
      isMounted = false;
    };
  }, [appliedPromo, authReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim() || isLoading) return;

    setInlineError(null);
    setIsLoading(true);

    try {
      const result = await applyPromoCode(promoCode.trim());

      if (result.success) {
        showNotification(result.message, 'success');
        setPromoCode('');
      } else {
        setInlineError(result.message || 'Unable to apply promo code');
        showNotification(result.message, 'error');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Error applying promo code';
      setInlineError(errorMsg);
      showNotification(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePromo = () => {
    removePromoCode();
    showNotification('Promo code removed', 'info');
  };

  const applySuggested = async (code: string) => {
    setInlineError(null);
    setPromoCode(code);
    setIsLoading(true);
    try {
      const result = await applyPromoCode(code.trim());
      if (result.success) {
        showNotification(result.message, 'success');
        setPromoCode('');
      } else {
        setInlineError(result.message || 'Unable to apply promo code');
        showNotification(result.message, 'error');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Error applying promo code';
      setInlineError(errorMsg);
      showNotification(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {appliedPromo ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-discount-percent-line text-green-600"></i>
              </div>
              <div>
                <div className="font-medium text-green-800 text-sm">
                  {appliedPromo.code} Applied
                </div>
                <div className="text-green-600 text-xs">
                  {appliedPromo.discount_type === 'percentage'
                    ? `${appliedPromo.discount_value}% off`
                    : appliedPromo.discount_type === 'fixed'
                    ? `$${appliedPromo.discount_value} off`
                    : 'Free Delivery'}
                </div>
              </div>
            </div>
            <button
              onClick={handleRemovePromo}
              className="text-green-600 hover:text-green-700 transition-colors cursor-pointer"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-close-line"></i>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-2">Promo Code</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                if (inlineError) setInlineError(null);
              }}
              placeholder="Enter promo code"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              disabled={isLoading}
              aria-invalid={!!inlineError}
              aria-describedby={inlineError ? 'promo-error' : undefined}
            />
            <button
              type="submit"
              disabled={!promoCode.trim() || isLoading}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer whitespace-nowrap text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Applying...' : 'Apply'}
            </button>
          </div>

          {inlineError && (
            <p id="promo-error" role="alert" className="mt-2 text-xs text-red-600">
              {inlineError}
            </p>
          )}

          {availablePromos.length > 0 && (
            <div className="mt-3 text-xs">
              <div className="text-gray-600 mb-1">Try these public promos:</div>
              <div className="flex flex-wrap gap-2">
                {availablePromos.map((p) => (
                  <div key={p.code} className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1 bg-gray-50">
                    <span className="font-medium text-gray-800">{p.code}</span>
                    <span className="text-gray-500">
                      {p.discount_type === 'percentage'
                        ? `${p.discount_value}% off`
                        : p.discount_type === 'fixed'
                        ? `$${p.discount_value} off`
                        : 'Free Delivery'}
                    </span>
                    <button
                      type="button"
                      onClick={() => applySuggested(p.code)}
                      className="text-green-700 hover:text-green-800 font-medium"
                    >
                      Apply
                    </button>
                  </div>
                ))}
                {isSuggestLoading && (
                  <span className="text-gray-400">Loading suggestions…</span>
                )}
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
