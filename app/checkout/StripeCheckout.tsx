'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/auth';

interface StripeCheckoutProps {
  orderId: string;
  amount: number;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export default function StripeCheckout({
  orderId,
  amount,
  customerInfo,
  onSuccess,
  onError,
  onCancel
}: StripeCheckoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Load Stripe.js
    const loadStripe = async () => {
      if (window.Stripe) {
        const stripeInstance = window.Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
        setStripe(stripeInstance);
      } else {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = () => {
          const stripeInstance = window.Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
          setStripe(stripeInstance);
        };
        document.head.appendChild(script);
      }
    };

    loadStripe();
  }, []);

  useEffect(() => {
    if (stripe) {
      createPaymentIntent();
    }
  }, [stripe]);

  const createPaymentIntent = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('stripe-payment-intent', {
        body: {
          action: 'create_intent',
          orderId,
          amount,
          currency: 'cad',
          customerInfo
        }
      });

      if (error) throw error;

      if (data.success) {
        setClientSecret(data.client_secret);
        
        const elementsInstance = stripe.elements({
          clientSecret: data.client_secret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#10b981',
              colorBackground: '#ffffff',
              colorText: '#111827',
              colorDanger: '#ef4444',
              fontFamily: 'system-ui, sans-serif',
              spacingUnit: '4px',
              borderRadius: '8px'
            }
          }
        });
        
        setElements(elementsInstance);
      } else {
        throw new Error(data.error || 'Failed to create payment intent');
      }
    } catch (err: any) {
      console.error('Payment intent creation error:', err);
      setError(err.message || 'Failed to initialize payment');
      onError(err.message || 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error: confirmError, paymentIntent: _paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/order-success?orderId=${orderId}`,
          payment_method_data: {
            billing_details: {
              name: `${customerInfo.firstName} ${customerInfo.lastName}`,
              email: customerInfo.email,
            }
          }
        },
        redirect: 'if_required'
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      // Payment authorized successfully (webhook will update status to pre_authorized)
      onSuccess();

    } catch (err: any) {
      console.error('Payment confirmation error:', err);
      setError(err.message || 'Payment failed');
      onError(err.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Setting up payment</h3>
            <p className="text-gray-600">Please wait while we prepare your secure payment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !elements) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-2xl text-red-600"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Setup Failed</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={createPaymentIntent}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
              >
                Try Again
              </button>
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Secure Payment</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-close-line text-xl"></i>
              </div>
            </button>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">Order #{orderId.slice(-8)}</span>
              <span className="font-semibold text-gray-900">${amount.toFixed(2)} CAD</span>
            </div>
            <div className="text-sm text-gray-500">
              Customer: {customerInfo.firstName} {customerInfo.lastName}
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                <i className="ri-shield-check-line text-blue-600"></i>
              </div>
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">Pre-Authorization Payment</div>
                <p>This payment will be pre-authorized but not charged until your order is confirmed with final weights and pricing.</p>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          {elements && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div id="payment-element">
                <PaymentElement elements={elements} />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-error-warning-line text-red-600"></i>
                    </div>
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isProcessing}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !stripe || !elements}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
                >
                  {isProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    `Authorize $${amount.toFixed(2)}`
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Security Notice */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <i className="ri-lock-line"></i>
              <span>Secured by Stripe</span>
            </div>
            <p>Your payment information is encrypted and secure. No charges will be made until your order is confirmed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Payment Element Component
function PaymentElement({ elements }: { elements: any }) {
  const [paymentElement, setPaymentElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (elements && paymentElement) {
      const element = elements.create('payment');
      element.mount(paymentElement);
      
      return () => {
        element.unmount();
      };
    }
  }, [elements, paymentElement]);

  return <div ref={setPaymentElement} className="min-h-[200px]" />;
}

// Extend Window interface for Stripe
declare global {
  interface Window {
    Stripe: any;
  }
}
