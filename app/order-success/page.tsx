'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase, SUPABASE_URL } from '../../lib/auth';

interface OrderDetails {
  id: string;
  order_number: string;
  total: number;
  tip_amount?: number;
  payment_method: string;
  payment_status: string;
  status: string;
  delivery_date: string;
  delivery_time_slot: string;
  delivery_address: string;
  created_at: string;
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const sessionId = searchParams.get('session_id');
  const paymentStatus = searchParams.get('payment');
  const orderNumber = searchParams.get('orderNumber');
  const total = searchParams.get('total');
  const paymentMethod = searchParams.get('paymentMethod');

  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!orderId) {
        setError('Order ID not found');
        setLoading(false);
        return;
      }

      try {
        // Get current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          setError('Please sign in to view order details');
          setLoading(false);
          return;
        }

        // If coming from Stripe, update payment status first
        if (sessionId && paymentStatus === 'success') {
          if (!SUPABASE_URL) {
            console.warn('Skipping webhook call: NEXT_PUBLIC_SUPABASE_URL not configured');
          } else {
            try {
              const response = await fetch(
                `${SUPABASE_URL}/functions/v1/stripe-webhook`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({
                    type: 'checkout.session.completed',
                    data: {
                      object: {
                        id: sessionId,
                        metadata: {
                          order_id: orderId
                        }
                      }
                    }
                  }),
                }
              );

              if (!response.ok) {
                console.warn('Failed to update payment status via webhook');
              }
            } catch (webhookError) {
              console.warn('Webhook update failed:', webhookError);
            }
          }
        }

        // Fetch order details from database (include tip_amount)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            total,
            tip_amount,
            payment_method,
            payment_status,
            status,
            delivery_date,
            delivery_time_slot,
            delivery_address,
            created_at
          `)
          .eq('id', orderId)
          .eq('customer_id', session.user.id)
          .single();

        if (orderError || !order) {
          console.error('Order fetch error:', orderError);
          setError('Order not found or access denied');
          setLoading(false);
          return;
        }

        setOrderDetails(order);
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, sessionId, paymentStatus]);

  // Format delivery time display
  const formatDeliveryTime = () => {
    if (!orderDetails?.delivery_date || !orderDetails?.delivery_time_slot) {
      return '2-4 hours';
    }

    const deliveryDate = new Date(orderDetails.delivery_date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateDisplay = '';
    if (deliveryDate.toDateString() === today.toDateString()) {
      dateDisplay = 'Today';
    } else if (deliveryDate.toDateString() === tomorrow.toDateString()) {
      dateDisplay = 'Tomorrow';
    } else {
      dateDisplay = deliveryDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }

    return `${dateDisplay}, ${orderDetails.delivery_time_slot}`;
  };

  // Get payment method display
  const getPaymentMethodDisplay = () => {
    if (orderDetails?.payment_method === 'card' || sessionId) {
      return 'Stripe';
    }
    if (orderDetails?.payment_method === 'interac') {
      return 'Interac e-Transfer';
    }
    return paymentMethod === 'card' ? 'Stripe' : 'Cash on Delivery';
  };

  // Get payment status display
  const getPaymentStatusDisplay = () => {
    if (sessionId || paymentStatus === 'success') {
      return { text: 'Paid', color: 'bg-green-100 text-green-800' };
    }
    if (orderDetails?.payment_status === 'paid') {
      return { text: 'Paid', color: 'bg-green-100 text-green-800' };
    }
    if (orderDetails?.payment_method === 'interac') {
      return { text: 'Pending', color: 'bg-yellow-100 text-yellow-800' };
    }
    return { text: 'On Delivery', color: 'bg-orange-100 text-orange-800' };
  };

  // Get order status display
  const getOrderStatusDisplay = () => {
    if (sessionId || orderDetails?.payment_status === 'paid') {
      return { text: 'Preparing', color: 'bg-yellow-100 text-yellow-800' };
    }
    if (orderDetails?.status) {
      const status = orderDetails.status;
      if (status === 'confirmed' || status === 'preparing') {
        return { text: 'Preparing', color: 'bg-yellow-100 text-yellow-800' };
      }
      if (status === 'ready') {
        return { text: 'Ready', color: 'bg-blue-100 text-blue-800' };
      }
      if (status === 'delivered') {
        return { text: 'Delivered', color: 'bg-green-100 text-green-800' };
      }
    }
    return { text: 'Preparing', color: 'bg-yellow-100 text-yellow-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order confirmation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-lg text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <div className="w-12 h-12 flex items-center justify-center">
              <i className="ri-error-warning-line text-4xl text-red-600"></i>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-8 text-lg">{error}</p>
          <Link 
            href="/" 
            className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap font-medium"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const paymentStatusInfo = getPaymentStatusDisplay();
  const orderStatusInfo = getOrderStatusDisplay();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-lg text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
          <div className="w-12 h-12 flex items-center justify-center">
            <i className="ri-check-line text-4xl text-green-600"></i>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
        
        <p className="text-gray-600 mb-8 text-lg">
          Thank you for your order! We've received your request and will start preparing your fresh groceries right away.
        </p>

        {/* Order Details */}
        <div className="bg-gray-50 rounded-xl p-6 mb-8 space-y-4">
          {(orderDetails?.order_number || orderNumber) && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Order Number</span>
              <span className="font-mono font-bold text-gray-900 text-lg">
                #{orderDetails?.order_number || orderNumber}
              </span>
            </div>
          )}
          
          {(orderDetails?.total || total) && (
            <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">Order Total</span>
                <span className="font-bold text-gray-900 text-xl">
                  ${(orderDetails?.total || parseFloat(total || '0')).toFixed(2)}
                </span>
              </div>

              {(orderDetails?.tip_amount || 0) > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Tip</span>
                  <span className="text-gray-900 font-medium">${Number(orderDetails?.tip_amount || 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Payment Method</span>
            <span className="text-gray-900 font-medium">{getPaymentMethodDisplay()}</span>
          </div>
        </div>

        {/* Status Information */}
        <div className="bg-blue-50 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-8 h-8 flex items-center justify-center mr-3">
              <i className="ri-truck-line text-2xl text-blue-600"></i>
            </div>
            <h3 className="text-lg font-semibold text-blue-900">Delivery Information</h3>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Estimated Delivery</span>
              <span className="font-medium text-blue-900">{formatDeliveryTime()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Order Status</span>
              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${orderStatusInfo.color}`}>
                {orderStatusInfo.text}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Payment</span>
              <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${paymentStatusInfo.color}`}>
                {paymentStatusInfo.text}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-8">
          <Link 
            href="/orders" 
            className="block w-full bg-green-600 text-white py-4 rounded-xl hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap font-semibold text-lg"
          >
            Track Your Order
          </Link>
          
          <Link 
            href="/products" 
            className="block w-full bg-gray-100 text-gray-700 py-4 rounded-xl hover:bg-gray-200 transition-colors cursor-pointer whitespace-nowrap font-medium"
          >
            Continue Shopping
          </Link>
          
          <Link 
            href="/" 
            className="block w-full text-gray-500 py-2 hover:text-gray-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            Back to Home
          </Link>
        </div>

        {/* Additional Information */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-6 h-6 flex items-center justify-center mr-2">
              <i className="ri-notification-line text-gray-400"></i>
            </div>
            <span className="text-sm font-medium text-gray-600">Stay Updated</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">
            You'll receive SMS and email updates about your delivery status. Our driver will contact you 15 minutes before arrival.
          </p>
        </div>

        {/* Contact Support */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">Need help with your order?</p>
          <Link 
            href="/contact" 
            className="inline-flex items-center text-green-600 hover:text-green-700 font-medium text-sm cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center mr-2">
              <i className="ri-customer-service-line"></i>
            </div>
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order confirmation...</p>
        </div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
