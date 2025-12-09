'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { cartStore, CartItem, DeliveryInfo, PromoCode } from '../lib/cart-store';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/auth';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  tax: number;
  gst: number;
  pst: number;
  deliveryFee: number;
  discount: number;
  total: number;
  deliveryInfo: DeliveryInfo;
  appliedPromo: PromoCode | null;
  addItem: (product: Omit<CartItem, 'quantity'>, quantity?: number) => boolean;
  updateQuantity: (id: string, quantity: number) => boolean;
  removeItem: (id: string) => void;
  clearCart: () => void;
  updateDeliveryInfo: (info: DeliveryInfo) => void;
  applyPromoCode: (code: string) => Promise<{ success: boolean; message: string }>;
  removePromoCode: () => void;
  addItemByName: (name: string, quantity?: number) => boolean;
  getCartSummary: () => any;
  syncCartWithDatabase: () => Promise<void>;
  checkout: (orderData: any) => Promise<any>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [itemCount, setItemCount] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [gst, setGST] = useState(0);
  const [pst, setPST] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [total, setTotal] = useState(0);
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo>({
    postalCode: '',
    estimatedTime: 'Next available slot',
    fee: 5.00
  });
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);

  useEffect(() => {
    const updateState = () => {
      setItems(cartStore.getItems());
      setItemCount(cartStore.getItemCount());
      setSubtotal(cartStore.getSubtotal());
      setTax(cartStore.getTax());
      setGST(cartStore.getGST());
      setPST(cartStore.getPST());
      setDeliveryFee(cartStore.getDeliveryFee());
      setDiscount(cartStore.getDiscount());
      setTotal(cartStore.getTotal());
      setDeliveryInfo(cartStore.getDeliveryInfo());
      setAppliedPromo(cartStore.getAppliedPromo());
    };

    updateState();
    const unsubscribe = cartStore.subscribe(updateState);
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      syncCartWithDatabase();
    }
  }, [user]);

  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const syncCartWithDatabase = async () => {
    if (!user) return;

    try {
      // Get current local cart items before syncing
      const localItems = cartStore.getItems();

      const { data: cartItems, error } = await supabase
        .from('carts')
        .select(`
          *,
          products(*)
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error syncing cart with database:', error);
        return;
      }

      // Create a map of local items for easy lookup
      const localItemMap = new Map(localItems.map(item => [item.id, item]));
      const databaseItemMap = new Map();

      // Process database items
      cartItems?.forEach(cartItem => {
        if (cartItem.products) {
          databaseItemMap.set(cartItem.products.id, {
            product: {
              id: cartItem.products.id,
              name: cartItem.products.name,
              image: cartItem.products.image_url,
              price: cartItem.products.price,
              originalPrice: cartItem.products.original_price,
              unit: cartItem.products.unit,
              category: cartItem.products.category,
              isOrganic: cartItem.products.is_organic,
              inStock: cartItem.products.in_stock || cartItem.products.stock_quantity,
              sku: cartItem.products.sku,
              scalable: cartItem.products.scalable,
              taxType: cartItem.products.tax_type || 'none',
              // include bottle price from DB product if present
              bottlePrice: (cartItem.products as any).bottle_price ?? (cartItem.products as any).bottlePrice ?? 0
            },
            quantity: cartItem.quantity
          });
        }
      });

      // Clear cart and rebuild with merged items
      cartStore.clearCart();

      // Add local items first (they have priority)
      localItems.forEach(item => {
        cartStore.addItem({
          id: item.id,
          name: item.name,
          image: item.image,
          bottle_price: (item as any).bottlePrice ?? 0,
          price: item.price,
          originalPrice: item.originalPrice,
          unit: item.unit,
          category: item.category,
          isOrganic: item.isOrganic,
          inStock: item.inStock,
          sku: item.sku,
          scalable: item.scalable,
          taxType: item.taxType || 'none'
        }, item.quantity);
      });

      // Add database items that aren't in local cart (to preserve past items)
      databaseItemMap.forEach((item, productId) => {
        if (!localItemMap.has(productId)) {
          cartStore.addItem(item.product, item.quantity);
        }
      });

      // Sync local items to database for persistence
      for (const localItem of localItems) {
        if (isValidUUID(localItem.id)) {
          await addItemToDatabase(localItem.id, localItem.quantity);
        }
      }
    } catch (error) {
      console.error('Error syncing cart with database:', error);
    }
  };

  const addItemToDatabase = async (productId: string, quantity: number) => {
    if (!user || !isValidUUID(productId)) return;

    try {
      const { error } = await supabase
        .from('carts')
        .upsert({
          user_id: user.id,
          product_id: productId,
          quantity: quantity
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) {
        console.error('Error adding item to database cart:', error);
      }
    } catch (error) {
      console.error('Error adding item to database cart:', error);
    }
  };

  const removeItemFromDatabase = async (productId: string) => {
    if (!user || !isValidUUID(productId)) return;

    try {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);

      if (error) {
        console.error('Error removing item from database cart:', error);
      }
    } catch (error) {
      console.error('Error removing item from database cart:', error);
    }
  };

  const clearDatabaseCart = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('carts')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing database cart:', error);
      }
    } catch (error) {
      console.error('Error clearing database cart:', error);
    }
  };

  const checkout = async (orderData: any) => {
    if (!user?.id) {
      throw new Error('Please sign in to place an order');
    }

    try {
      // Get current cart items from both state and store as fallback
      const stateItems = items || [];
      const storeItems = cartStore.getItems() || [];

      // Use whichever has items, prefer state items
      const currentItems = stateItems.length > 0 ? stateItems : storeItems;

      // Only throw error if both sources confirm cart is empty
      if (!currentItems || currentItems.length === 0) {
        // Double check by forcing a fresh read from store
        const freshItems = cartStore.getItems();
        if (!freshItems || freshItems.length === 0) {
          throw new Error('Your cart is empty. Please add items before checkout.');
        }
      }

      // Determine which items to use for the order
      const itemsToUse = currentItems.length > 0 ? currentItems : cartStore.getItems();
      
      // Final validation
      if (!itemsToUse || itemsToUse.length === 0) {
        throw new Error('Unable to process order. Please refresh the page and try again.');
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Please sign in again to place your order');
      }

      // Comprehensive user data extraction with multiple fallbacks
      const userMetadata = (user as any)?.user_metadata || {};
      const userEmail = user?.email || 
                       userMetadata?.email || 
                       userMetadata?.Email ||
                       orderData?.customerInfo?.email || 
                       '';

      const userFirstName = userMetadata?.first_name || 
                           userMetadata?.firstName || 
                           userMetadata?.given_name ||
                           orderData?.customerInfo?.firstName || 
                           orderData?.customerInfo?.first_name ||
                           '';

      const userLastName = userMetadata?.last_name || 
                          userMetadata?.lastName || 
                          userMetadata?.family_name ||
                          orderData?.customerInfo?.lastName || 
                          orderData?.customerInfo?.last_name ||
                          '';

      const userPhone = userMetadata?.phone || 
                       userMetadata?.phone_number ||
                       orderData?.customerInfo?.phone || 
                       orderData?.customerInfo?.phoneNumber ||
                       '';

      // Validate required fields before sending
      if (!userEmail) {
        throw new Error('Email address is required. Please update your profile or provide email in checkout.');
      }
      if (!userFirstName) {
        throw new Error('First name is required. Please update your profile or provide name in checkout.');
      }

      // Validate delivery slot structure
      if (!orderData?.deliverySlot) {
        throw new Error('Please select a delivery time slot.');
      }

      // Ensure delivery slot has required properties
      const deliverySlot = {
        date: orderData.deliverySlot.date || new Date().toISOString().split('T')[0],
        timeSlot: orderData.deliverySlot.timeSlot || orderData.deliverySlot.displayTime || '9:00-12:00',
        displayTime: orderData.deliverySlot.displayTime || orderData.deliverySlot.timeSlot || '9:00 AM - 12:00 PM',
        id: orderData.deliverySlot.id || `slot_${Date.now()}`,
        available: orderData.deliverySlot.available !== false
      };

      // Ensure all required customer data is included with comprehensive fallbacks
      const completeOrderData = {
        ...orderData,
        paymentMethod: orderData?.paymentMethod || 'interac',
        deliveryFee: typeof deliveryFee === 'number' ? parseFloat(deliveryFee.toFixed(2)) : 5.00,
        discount: typeof discount === 'number' ? parseFloat(discount.toFixed(2)) : 0,
        tipAmount: typeof orderData?.tipAmount === 'number' ? parseFloat(Number(orderData.tipAmount).toFixed(2)) : 0,
        deliverySlot: deliverySlot,
        customerInfo: {
          email: userEmail,
          firstName: userFirstName,
          lastName: userLastName,
          phone: userPhone,
          ...(orderData?.customerInfo || {})
        },
        cartItems: itemsToUse
      };

      console.log('📤 Order Summary Before Sending:', {
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        discount: discount.toFixed(2),
        tipAmount: completeOrderData.tipAmount || 0,
        appliedPromoCode: appliedPromo?.code || 'None',
        discountType: appliedPromo?.discount_type || 'None',
        total: completeOrderData.discount ? (subtotal + tax + deliveryFee - discount + (completeOrderData.tipAmount || 0)).toFixed(2) : (subtotal + tax + deliveryFee + (completeOrderData.tipAmount || 0)).toFixed(2),
      });

      console.log('📤 Complete Order Data:', {
        orderData: completeOrderData,
        cartItems: itemsToUse,
        tipAmountFromOrderData: completeOrderData.tipAmount,
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          orderData: completeOrderData,
          cartItems: itemsToUse
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error('Order creation failed:', {
          status: response.status,
          error: result.error,
          details: result.details,
          fullError: result.fullError
        });
        throw new Error(result.details || result.error || 'Failed to create order');
      }

      // Track promo code usage if a promo code was applied
      if (appliedPromo?.id) {
        const { PromocodeService } = await import('../lib/promo-code');
        const discountAmount = discount || 0;
        await PromocodeService.trackPromoCodeUsage(
          appliedPromo.id,
          discountAmount,
          user?.id,
          result.orderId || result.order?.id
        );
      }

      // Clear local cart immediately after successful order
      cartStore.clearCart();

      // Clear database cart
      if (user) {
        await clearDatabaseCart();
      }

      return {
        success: true,
        orderId: result.orderId || result.order?.id,
        orderNumber: result.orderNumber || result.order?.order_number,
        total: result.total || result.order?.total,
        message: result.message
      };

    } catch (error: any) {
      console.error('Checkout error:', error);
      throw error;
    }
  };

  const enhancedAddItem = (product: Omit<CartItem, 'quantity'>, quantity: number = 1): boolean => {
    const success = cartStore.addItem(product, quantity);
    if (success && user && isValidUUID(product.id)) {
      addItemToDatabase(product.id, quantity);
    }
    return success;
  };

  const enhancedUpdateQuantity = (id: string, quantity: number): boolean => {
    const success = cartStore.updateQuantity(id, quantity);
    if (success && user && isValidUUID(id)) {
      if (quantity <= 0) {
        removeItemFromDatabase(id);
      } else {
        addItemToDatabase(id, quantity);
      }
    }
    return success;
  };

  const enhancedRemoveItem = (id: string): void => {
    cartStore.removeItem(id);
    if (user && isValidUUID(id)) {
      removeItemFromDatabase(id);
    }
  };

  const enhancedClearCart = (): void => {
    cartStore.clearCart();
    if (user) {
      clearDatabaseCart();
    }
  };

  const enhancedApplyPromoCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('🎯 Apply promo code triggered:', { code, currentSubtotal: subtotal });

      // Validate promo code against Supabase
      const { PromocodeService } = await import('../lib/promo-code');
      const validation = await PromocodeService.validatePromoCode(
        code,
        cartStore.getSubtotal(),
        user?.id
      );

      console.log('📋 Validation result:', { success: validation.success, message: validation.message, promoCode: validation.promoCode?.code });

      if (!validation.success || !validation.promoCode) {
        console.warn('❌ Promo code validation failed:', validation.message);
        return { success: false, message: validation.message };
      }

      // Apply validated promo code to cart
      console.log('💾 Applying promo code to cart store:', { code: validation.promoCode.code });
      const result = cartStore.applyPromoCode(validation.promoCode);
      console.log('✅ Promo code applied:', result);
      return result;
    } catch (error: any) {
      console.error('❌ Error applying promo code:', error);
      return { success: false, message: 'Error applying promo code' };
    }
  };

  const enhancedUpdateDeliveryInfo = (info: DeliveryInfo) => {
    cartStore.updateDeliveryInfo(info.postalCode);
    setDeliveryInfo(info);
  };

  const enhancedAddItemByName = (name: string, quantity?: number) => {
    const result = cartStore.addItemByName(name, quantity);
    return result.success;
  };

  const value: CartContextType = {
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
    addItem: enhancedAddItem,
    updateQuantity: enhancedUpdateQuantity,
    removeItem: enhancedRemoveItem,
    clearCart: enhancedClearCart,
    updateDeliveryInfo: enhancedUpdateDeliveryInfo,
    applyPromoCode: enhancedApplyPromoCode,
    removePromoCode: cartStore.removePromoCode.bind(cartStore),
    addItemByName: enhancedAddItemByName,
    getCartSummary: cartStore.getCartSummary.bind(cartStore),
    syncCartWithDatabase,
    checkout
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
