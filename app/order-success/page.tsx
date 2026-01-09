'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase, SUPABASE_URL } from '../../lib/auth';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  bottle_price?: number | null;
  total_price: number;
  product: {
    id: string;
    name: string;
    unit: string;
    image_url?: string;
  };
}

interface OrderDetails {
  id: string;
  order_number: string;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  gst: number | null;
  pst: number | null;
  delivery_fee: number | null;
  discount: number | null;
  tip_amount: number | null;
  payment_method: string | null;
  payment_status: string | null;
  status: string | null;
  delivery_date: string | null;
  delivery_time_slot: string | null;
  delivery_address: string;
  created_at: string | null;
  order_items: OrderItem[];
}


function OrderSuccessContent() {
  const [_orderId, setOrderId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [total, setTotal] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const fetchOrderDetails = async () => {
      if (!isMountedRef.current) return;

      // Read URL params directly here to avoid race condition with state
      const urlParams = new URLSearchParams(window.location.search || '');
      const urlOrderId = urlParams.get('orderId');
      const urlSessionId = urlParams.get('session_id');
      const urlPaymentStatus = urlParams.get('payment');

      console.log('Reading URL params directly in fetch effect:', {
        urlOrderId,
        urlSessionId,
        urlPaymentStatus,
      });

      // Update state with URL params for display purposes
      setOrderId(urlOrderId);
      setSessionId(urlSessionId);
      setPaymentStatus(urlPaymentStatus);
      setOrderNumber(urlParams.get('orderNumber'));
      setTotal(urlParams.get('total'));
      setPaymentMethod(urlParams.get('paymentMethod'));

      if (!urlOrderId) {
        console.warn('Order ID missing from URL parameters', {
          search: window.location.search,
          urlOrderId,
          urlSessionId,
          urlPaymentStatus,
        });
        if (isMountedRef.current) {
          setError('Order ID not found in URL. Please check the link or contact support if you believe this is an error.');
          setLoading(false);
        }
        return;
      }

      try {
        // Get current user session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (!isMountedRef.current) return;

        if (sessionError || !session) {
          if (isMountedRef.current) {
            setError('Please sign in to view order details');
            setLoading(false);
          }
          return;
        }

        // If coming from Stripe, update payment status first
        if (urlSessionId && urlPaymentStatus === 'success') {
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
                        id: urlSessionId,
                        metadata: {
                          order_id: urlOrderId
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

        // Fetch order details from database (include tip_amount and order items)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            total,
            subtotal,
            tax,
            gst,
            pst,
            delivery_fee,
            discount,
            tip_amount,
            payment_method,
            payment_status,
            status,
            delivery_date,
            delivery_time_slot,
            delivery_address,
            created_at,
            order_items(
              id,
              quantity,
              unit_price,
              bottle_price,
              total_price,
              products(id, name, unit, image_url)
            )
          `)
          .eq('id', urlOrderId)
          .eq('customer_id', session.user.id)
          .single();

        if (!isMountedRef.current) return;

        if (orderError || !order) {
          console.error('Order fetch error:', {
            error: orderError,
            urlOrderId,
            urlSessionId,
            userId: session.user.id
          });
          if (isMountedRef.current) {
            setError('Order not found or access denied');
            setLoading(false);
          }
          return;
        }

        const normalizedOrder: OrderDetails = {
          ...order,
          order_items: order.order_items.map((item: any) => {
            // Handle products that might come back as an array from PostgREST
            const productData = Array.isArray(item.products) ? item.products[0] : item.products;
            const bottlePrice = item.bottle_price ? Number(item.bottle_price) : undefined;
            return {
              id: item.id,
              quantity: Number(item.quantity),
              unit_price: Number(item.unit_price),
              bottle_price: bottlePrice,
              total_price: Number(item.total_price),
              product: productData ?? {
                id: '',
                name: 'Unknown product',
                unit: '',
                image_url: undefined,
              },
            };
          }),
        };

        if (isMountedRef.current) {
          setOrderDetails(normalizedOrder);
        }
      } catch (err) {
        console.error('Error fetching order details:', err);
        if (isMountedRef.current) {
          setError('Failed to load order details');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchOrderDetails();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Format delivery time display
  const formatDeliveryTime = () => {
    if (!orderDetails?.delivery_date || !orderDetails?.delivery_time_slot) {
      return 'Next available slot';
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

        {/* Order Items */}
        {orderDetails?.order_items && orderDetails.order_items.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Order Items</h3>
            <div className="space-y-4">
              {orderDetails.order_items.map((item) => (
                <div key={item.id} className="flex items-start space-x-3 p-3 bg-white rounded-lg">
                  {/* Product Image */}
                  {item.product.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className="w-12 h-12 object-contain bg-gray-50 rounded-lg p-2 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <i className="ri-image-line text-gray-400"></i>
                    </div>
                  )}

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">{item.product.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {item.quantity} {item.product.unit} × ${item.unit_price.toFixed(2)}
                    </div>
                    {item.bottle_price && item.bottle_price > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        Bottle deposit: ${(item.bottle_price * item.quantity).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-medium text-gray-900 text-sm">
                      ${(item.total_price + ((item.bottle_price || 0) * item.quantity)).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

          {(orderDetails?.subtotal || 0) > 0 && (
            <div>
              <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                <span>Subtotal</span>
                <span>${(orderDetails?.subtotal || 0).toFixed(2)}</span>
              </div>
              {(orderDetails?.gst || 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>GST (5%)</span>
                  <span>${(orderDetails?.gst || 0).toFixed(2)}</span>
                </div>
              )}
              {(orderDetails?.pst || 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>PST (7%)</span>
                  <span>${(orderDetails?.pst || 0).toFixed(2)}</span>
                </div>
              )}
              {(orderDetails?.delivery_fee || 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-gray-600 mb-2">
                  <span>Delivery Fee</span>
                  <span>${(orderDetails?.delivery_fee || 0).toFixed(2)}</span>
                </div>
              )}
              {(orderDetails?.discount || 0) > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 mb-2">
                  <span>Discount</span>
                  <span>-${(orderDetails?.discount || 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {(orderDetails?.total || total) && (
            <div className="flex flex-col space-y-2 border-t border-gray-200 pt-4">
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
  return <OrderSuccessContent />;
}
