'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../components/EnhancedCartProvider';
import { supabase, SUPABASE_URL, SUPABASE_CONFIGURED } from '../../lib/auth';
import { fetchPaymentSettings, PaymentSettings } from '../../lib/payment-settings';
import { useCartNotification } from '../../components/CartNotification';
import { useAuth } from '../../components/AuthProvider';
import CartNotification from '../../components/CartNotification';
import DeliveryScheduler from '../../components/DeliveryScheduler';
import AuthModal from '../../components/AuthModal';
import StripeCheckout from './StripeCheckout';

interface CheckoutForm {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryInstructions: string;
  saveInfo: boolean;
}

interface DeliverySlot {
  id: string;
  date: string;
  timeSlot: string;
  displayTime: string;
  available: boolean;
  capacity: number;
  used: number;
}

function getVancouverDateForCheckout(offsetDays = 0): string {
  const now = new Date();

  const parts = Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parseInt(parts.find(p => p.type === "year")!.value);
  const month = parseInt(parts.find(p => p.type === "month")!.value);
  const day = parseInt(parts.find(p => p.type === "day")!.value);

  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);

  return base.toISOString().split("T")[0];
}

function getCheckoutDeliveryDateLabel(dateStr: string): string {
  const todayStr = getVancouverDateForCheckout(0);
  const tomorrowStr = getVancouverDateForCheckout(1);

  if (dateStr === todayStr) {
    return 'Today';
  } else if (dateStr === tomorrowStr) {
    return 'Tomorrow';
  } else {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Vancouver'
    });
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [createdOrderId, _setCreatedOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'interac' | 'card'>('card');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);

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
    checkout,
  } = useCart();

  const { notification, showNotification, hideNotification } = useCartNotification();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDeliverySlot, setSelectedDeliverySlot] = useState<DeliverySlot | null>(null);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTipAmount, setCustomTipAmount] = useState('');

  const [form, setForm] = useState<CheckoutForm>({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    apartment: '',
    city: 'Vancouver',
    province: 'BC',
    postalCode: deliveryInfo?.postalCode || '',
    deliveryInstructions: '',
    saveInfo: false,
  });

  // Fetch payment settings
  useEffect(() => {
    const loadPaymentSettings = async () => {
      const settings = await fetchPaymentSettings();
      setPaymentSettings(settings);

      // Set default payment method based on availability
      if (!settings.stripe_enabled && settings.interac_enabled) {
        setPaymentMethod('interac');
      } else if (settings.stripe_enabled) {
        setPaymentMethod('card');
      }
    };
    loadPaymentSettings();
  }, []);
const paymentsDisabled =
  !!paymentSettings &&
  !(paymentSettings.stripe_enabled ?? false) &&
  !(paymentSettings.interac_enabled ?? false);

  // Give the cart a moment to load before rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only set loading to false if we have items or confirmed empty cart
      if (itemCount > 0 || items.length === 0) {
        setIsLoading(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [itemCount, items]);

  // Pre‑fill form with authenticated user data (if available)
  useEffect(() => {
    if (user?.email) {
      const userMetadata = (user as any)?.user_metadata || {};
      setForm(prev => ({
        ...prev,
        email: user.email || '',
        firstName:
          userMetadata?.first_name ||
          userMetadata?.firstName ||
          '',
        lastName:
          userMetadata?.last_name ||
          userMetadata?.lastName ||
          '',
        phone: userMetadata?.phone || '',
        address: userMetadata?.address || '',
        apartment: userMetadata?.apartment || '',
        city: userMetadata?.city || 'Vancouver',
        province: userMetadata?.province || 'BC',
        postalCode:
          userMetadata?.postal_code ||
          userMetadata?.postalCode ||
          deliveryInfo?.postalCode ||
          '',
      }));
    }
  }, [user, deliveryInfo]);

  // Input change handler
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Tip handlers
  const handlePresetTip = (amount: number) => {
    setTipAmount(amount);
    setCustomTipAmount('');
  };

  const handleCustomTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomTipAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      setTipAmount(parseFloat(value));
    } else {
      setTipAmount(0);
    }
  };

  const totalWithTip = total + tipAmount;

  // Submit checkout
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      // Get current cart items directly from the cart store
      const currentCartItems = items;
      
      // Validate cart has items
      if (!currentCartItems || currentCartItems.length === 0) {
        throw new Error('Your cart is empty. Please add items before checkout.');
      }

      // Basic validation
      if (!form.email || !form.firstName || !form.lastName || !form.phone) {
        throw new Error('Please fill in all required contact information');
      }
      if (!selectedDeliverySlot) {
        throw new Error('Please select a delivery time slot');
      }
      if (!user?.email) {
        throw new Error('Please sign in again to complete your order');
      }

      // Construct a clean delivery address string
      const deliveryAddress = `${form.address}${
        form.apartment ? `, ${form.apartment}` : ''
      }, ${form.city}, ${form.province} ${form.postalCode}`;

      const orderData = {
        deliveryAddress,
        deliveryInstructions: form.deliveryInstructions,
        paymentMethod,
        deliverySlot: selectedDeliverySlot,
        customerInfo: {
          email: form.email || user.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
        },
        discount: discount || 0,
        tipAmount: tipAmount || 0,
      };

      const result = await checkout(orderData);

      if (!result?.success) {
        throw new Error(result?.message || 'Order creation failed');
      }

      // Card payment flow – redirect to Stripe
      if (paymentMethod === 'card') {
        try {
          if (!SUPABASE_CONFIGURED) {
            throw new Error('Payment system not configured');
          }

          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError || !session) {
            throw new Error('Please sign in again to complete payment');
          }

          const stripeResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/stripe-payment-intent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                action: 'create_checkout_session',
                orderId: result.orderId,
                amount: totalWithTip,
                currency: 'cad',
                customerInfo: {
                  email: form.email || user.email,
                  firstName: form.firstName,
                  lastName: form.lastName,
                },
              }),
            },
          );

          const stripeResult = await stripeResponse.json();

          if (!stripeResponse.ok || !stripeResult.success) {
            throw new Error(stripeResult.error || 'Failed to create payment session');
          }

          // Redirect user to Stripe Checkout page
          window.location.href = stripeResult.checkout_url;
          return;
        } catch (stripeError: any) {
          console.error('Stripe checkout error:', stripeError);
          const msg = stripeError.message || 'Failed to redirect to payment. Please try again.';
          setError(msg);
          showNotification(msg, 'error');
        }
      } else {
        // Interac flow – show success message
        const successMessage = 'Order placed successfully! You will receive payment instructions shortly.';
        showNotification(successMessage, 'success');
        setTimeout(() => {
          router.push(
            `/order-success?orderId=${result.orderId}&orderNumber=${result.orderNumber}&total=${result.total}&paymentMethod=${paymentMethod}`,
          );
        }, 1500);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      const msg = err.message || 'Order placement failed. Please try again.';
      setError(msg);
      showNotification(msg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Stripe modal callbacks
  const handleStripeSuccess = () => {
    setShowStripeCheckout(false);
    showNotification('Payment completed successfully!', 'success');
    setTimeout(() => {
      router.push(
        `/order-success?orderId=${createdOrderId}&paymentMethod=card&paymentStatus=completed`,
      );
    }, 1500);
  };

  const handleStripeError = (msg: string) => {
    setShowStripeCheckout(false);
    setError(msg);
    showNotification(msg, 'error');
  };

  const handleStripeCancel = () => {
    setShowStripeCheckout(false);
    showNotification(
      'Payment cancelled. You can try again or choose a different payment method.',
      'info',
    );
  };

  // Validate each step before allowing navigation
  const validateStep = (step: number): boolean => {
    if (step === 1) {
      return !!(form.email && form.firstName && form.lastName && form.phone);
    }
    if (step === 2) {
      return true; // Remove address validation
    }
    if (step === 3) {
      return !!selectedDeliverySlot;
    }
    return true;
  };

  // -------------------------------------------------------------------------
  // Render logic
  // -------------------------------------------------------------------------

  // Prompt sign‑in for guests
  if (!loading && !user?.email) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
              <div className="w-16 h-16 flex items-center justify-center mx-auto mb-6 bg-green-100 rounded-full">
                <i className="ri-user-line text-2xl text-green-600"></i>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sign In Required</h2>
              <p className="text-gray-600 mb-6">
                Please sign in or create an account to proceed with checkout. This helps us save your
                delivery preferences and order history.
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap font-medium mb-4"
              >
                Sign In / Sign Up
              </button>
              <Link href="/products" className="text-green-600 hover:text-green-700 font-medium cursor-pointer">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} defaultMode="signin" />
      </div>
    );
  }

  // Loading indicator while auth/cart are initializing
  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    );
  }

  // Empty‑cart UI
  if (!loading && !isLoading && itemCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-100 rounded-full">
            <i className="ri-shopping-cart-line text-4xl text-gray-400"></i>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your cart is empty</h2>
          <p className="text-gray-600 mb-8">Add some items to your cart before checkout</p>
          <Link
            href="/products"
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  // Main checkout UI
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global notification */}
      <CartNotification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />

      {/* Stripe Checkout modal (fallback) */}
      {showStripeCheckout && createdOrderId && (
        <StripeCheckout
          orderId={createdOrderId}
          amount={total}
          customerInfo={{
            email: form.email || user?.email || '',
            firstName: form.firstName,
            lastName: form.lastName,
          }}
          onSuccess={handleStripeSuccess}
          onError={handleStripeError}
          onCancel={handleStripeCancel}
        />
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
          <p className="text-gray-600">Complete your order for fresh grocery delivery</p>
          {user?.email && (
            <div className="mt-2 text-sm text-green-600">
              <i className="ri-user-line mr-1"></i>Signed in as {user.email}
            </div>
          )}
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="w-5 h-5 flex items-center justify-center mr-3">
                <i className="ri-error-warning-line text-red-600"></i>
              </div>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Progress steps (mobile‑friendly) */}
        <div className="mb-8">
          <div className="flex items-center justify-between px-2 sm:justify-center sm:space-x-4 overflow-x-auto">
            {[
              { step: 1, title: 'Contact', icon: 'ri-user-line' },
              { step: 2, title: 'Delivery', icon: 'ri-map-pin-line' },
              { step: 3, title: 'Schedule', icon: 'ri-calendar-line' },
            ].map(({ step, title, icon }) => (
              <div key={step} className="flex items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                    currentStep >= step ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  <i className={icon}></i>
                </div>
                <span
                  className={`ml-1 sm:ml-2 font-medium text-xs sm:text-sm ${
                    currentStep >= step ? 'text-green-600' : 'text-gray-500'
                  } whitespace-nowrap`}
                >
                  {title}
                </span>
                {step < 3 && (
                  <div
                    className={`w-4 sm:w-12 h-0.5 ml-2 sm:ml-4 ${
                      currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form column */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Step 1 – Contact */}
              {currentStep >= 1 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Contact Information</h2>
                    {user?.email && (
                      <div className="text-sm text-green-600 flex items-center">
                        <i className="ri-check-line mr-1"></i>Pre-filled from profile
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="your@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="(604) 555-0123"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={form.firstName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="John"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={form.lastName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 – Delivery */}
              {currentStep >= 2 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Delivery Address</h2>
                    {user?.email && (form.address || form.city || form.postalCode) && (
                      <div className="text-sm text-green-600 flex items-center">
                        <i className="ri-check-line mr-1"></i>Pre-filled from profile
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Street Address *
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={form.address}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Apartment, Suite, etc.
                      </label>
                      <input
                        type="text"
                        name="apartment"
                        value={form.apartment}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Apt 4B"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City *
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={form.city}
                          onChange={handleInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Province *
                        </label>
                        <select
                          name="province"
                          value={form.province}
                          onChange={handleInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
                        >
                          <option value="BC">British Columbia</option>
                          <option value="AB">Alberta</option>
                          <option value="ON">Ontario</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Postal Code *
                        </label>
                        <input
                          type="text"
                          name="postalCode"
                          value={form.postalCode}
                          onChange={handleInputChange}
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="V6B 1A1"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Delivery Instructions
                      </label>
                      <textarea
                        name="deliveryInstructions"
                        value={form.deliveryInstructions}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Leave at door, ring bell, etc."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 – Schedule */}
              {currentStep >= 3 && (
                <DeliveryScheduler selectedSlot={selectedDeliverySlot} onSlotSelect={setSelectedDeliverySlot} />
              )}

              {/* Tipping */}
              {currentStep >= 3 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Add a Tip</h2>
                  <p className="text-gray-600 text-sm mb-4">Tips are optional — service stays exceptional</p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handlePresetTip(2)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all ${
                          tipAmount === 2
                            ? 'bg-green-600 text-white border-2 border-green-600'
                            : 'bg-gray-100 text-gray-900 border-2 border-gray-200 hover:border-green-400'
                        } cursor-pointer`}
                      >
                        $2
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetTip(5)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all ${
                          tipAmount === 5
                            ? 'bg-green-600 text-white border-2 border-green-600'
                            : 'bg-gray-100 text-gray-900 border-2 border-gray-200 hover:border-green-400'
                        } cursor-pointer`}
                      >
                        $5
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePresetTip(10)}
                        className={`py-3 px-4 rounded-lg font-medium transition-all ${
                          tipAmount === 10
                            ? 'bg-green-600 text-white border-2 border-green-600'
                            : 'bg-gray-100 text-gray-900 border-2 border-gray-200 hover:border-green-400'
                        } cursor-pointer`}
                      >
                        $10
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Other Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          value={customTipAmount}
                          onChange={handleCustomTipChange}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>

                    {tipAmount > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800 text-sm">
                          <i className="ri-heart-fill text-green-600 mr-2"></i>
                          Thanks for tipping ${tipAmount.toFixed(2)}!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Method */}
              {currentStep >= 3 && (
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Method</h2>

                  {/* No payment methods available message */}
                  {paymentSettings && !paymentSettings.stripe_enabled && !paymentSettings.interac_enabled ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <i className="ri-error-warning-line text-red-600 text-lg"></i>
                        </div>
                        <div>
                          <p className="font-medium text-red-900">No payment methods available</p>
                          <p className="text-sm text-red-800 mt-1">
                            We apologize, but no payment methods are currently available. Please contact support for assistance.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Card option */}
                      {paymentSettings?.stripe_enabled && (
                        <div
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                            paymentMethod === 'card'
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setPaymentMethod('card')}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="card"
                              checked={paymentMethod === 'card'}
                              onChange={e => setPaymentMethod(e.target.value as 'card' | 'interac')}
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="flex items-center">
                                <div className="w-6 h-6 flex items-center justify-center mr-3">
                                  <i className="ri-bank-card-line text-green-600"></i>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">Credit/Debit Card</div>
                                  <div className="text-sm text-gray-600">Pay securely with Stripe</div>
                                </div>
                              </div>
                              {paymentMethod === 'card' && (
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                  <div className="text-sm text-green-800">
                                    <div className="font-medium mb-1">Secure Card Payment:</div>
                                    <div>• Payment processed securely through Stripe</div>
                                    <div>• Supports all major credit and debit cards</div>
                                    <div>• Order prepared after payment confirmation</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interac option */}
                      {paymentSettings?.interac_enabled && (
                        <div
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                            paymentMethod === 'interac'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setPaymentMethod('interac')}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value="interac"
                              checked={paymentMethod === 'interac'}
                              onChange={e => setPaymentMethod(e.target.value as 'card' | 'interac')}
                              className="mr-3"
                            />
                            <div className="flex-1">
                              <div className="flex items-center">
                                <div className="w-6 h-6 flex items-center justify-center mr-3">
                                  <i className="ri-bank-line text-blue-600"></i>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">Interac e-Transfer</div>
                                  <div className="text-sm text-gray-600">Pay online with Interac e-Transfer</div>
                                </div>
                              </div>
                              {paymentMethod === 'interac' && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <div className="text-sm text-blue-800">
                                    <div className="font-medium mb-1">Payment Instructions:</div>
                                    <div>• Send e-Transfer to: <strong>payments@groceree.ca</strong></div>
                                    <div>• You'll receive a final invoice after order preparation</div>
                                    <div>• Order will be prepared once payment is confirmed</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <div>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Back
                    </button>
                  )}
                </div>

                <div>
                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep + 1)}
                      disabled={!validateStep(currentStep)}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
  type="submit"
  disabled={isProcessing || !validateStep(3) || paymentsDisabled}
  className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed font-medium"
>
                      {isProcessing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </div>
                      ) : (
                        `Place Order - $${totalWithTip.toFixed(2)}`
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Summary</h3>

              {/* Items */}
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center space-x-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt={item.name} className="w-12 h-12 object-contain bg-gray-50 rounded-lg p-2" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                        <div className="text-gray-500 text-xs">
                          {item.quantity} × ${item.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="font-medium text-gray-900 text-sm">
                        ${(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                    {item.bottle_price && item.bottle_price > 0 && (
                      <div className="flex justify-end text-xs text-blue-600 pl-15">
                        Bottle: ${(item.bottle_price * item.quantity).toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-4 mb-6">
                {(() => {
                  const bottleSales = items.reduce((total, item) => total + ((item.bottle_price || 0) * item.quantity), 0);
                  const productSubtotal = subtotal - bottleSales;
                  return (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Product Subtotal ({itemCount} items)</span>
                        <span>${productSubtotal.toFixed(2)}</span>
                      </div>
                      {bottleSales > 0 && (
                        <div className="flex justify-between text-blue-600">
                          <span>Bottle Sales/Deposits</span>
                          <span>${bottleSales.toFixed(2)}</span>
                        </div>
                      )}
                      {bottleSales === 0 && (
                        <div className="flex justify-between text-gray-600 text-sm">
                          <span>Subtotal</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  );
                })()}

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
                  <span>Delivery Fee</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>

                {tipAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tip</span>
                    <span>${tipAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-xl font-bold text-gray-900">
                    <span>Total</span>
                    <span>${totalWithTip.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {paymentMethod === 'card'
                      ? '* Payment via secure card processing'
                      : '* Payment via Interac e-Transfer before delivery'}
                  </div>
                </div>
              </div>

              {/* Delivery slot info */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-truck-line text-blue-600"></i>
                  </div>
                  <span className="font-medium text-blue-900">Delivery</span>
                </div>
                {selectedDeliverySlot ? (
                  <div className="text-sm text-blue-800">
                    {getCheckoutDeliveryDateLabel(selectedDeliverySlot.date)}
                    <br />
                    {selectedDeliverySlot.displayTime}
                  </div>
                ) : (
                  <div className="text-sm text-blue-800">Please select a delivery time slot</div>
                )}
              </div>

              {/* Payment method summary */}
              {currentStep >= 3 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <i
                        className={paymentMethod === 'card' ? 'ri-bank-card-line text-gray-600' : 'ri-bank-line text-gray-600'}
                      ></i>
                    </div>
                    <span className="font-medium text-gray-900">Payment Method</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {paymentMethod === 'card' ? 'Credit/Debit Card' : 'Interac e-Transfer'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
