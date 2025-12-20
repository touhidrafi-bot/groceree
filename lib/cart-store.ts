export interface CartItem {
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
  taxType?: 'none' | 'gst' | 'gst_pst';
  bottle_price?: number;
}

export interface DeliveryInfo {
  postalCode: string;
  estimatedTime: string;
  fee: number;
}

export interface PromoCode {
  id?: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed' | 'free_delivery';
  discount_value: number;
  min_order_amount?: number;
  max_uses?: number;
  current_uses?: number;
  uses_per_user_limit?: number;
  is_active?: boolean;
  is_public?: boolean;
  start_date?: string;
  end_date?: string;
  expires_at?: string;
}

class CartStore {
  private items: CartItem[] = [];
  private deliveryInfo: DeliveryInfo = {
    postalCode: '',
    estimatedTime: 'Next available slot',
    fee: 5.00
  };
  private appliedPromo: PromoCode | null = null;
  private listeners: (() => void)[] = [];

  // Mock product database for addItemByName functionality
  private mockProducts: Omit<CartItem, 'quantity'>[] = [
    {
      id: 'organic-bananas',
      name: 'Organic Bananas',
      image: 'https://readdy.ai/api/search-image?query=fresh%20organic%20bananas%20bunch%20yellow%20ripe%20healthy%20natural%20grocery%20store%20simple%20white%20background&width=400&height=400&seq=1&orientation=squarish',
      price: 2.99,
      unit: 'bunch',
      category: 'Produce',
      isOrganic: true,
      inStock: 50,
      sku: 'ORG-BAN-001',
      scalable: false,
      taxType: 'none'
    },
    {
      id: 'organic-apples',
      name: 'Organic Gala Apples',
      image: 'https://readdy.ai/api/search-image?query=fresh%20organic%20gala%20apples%20red%20yellow%20crisp%20healthy%20natural%20grocery%20store%20simple%20white%20background&width=400&height=400&seq=2&orientation=squarish',
      price: 1.99,
      originalPrice: 2.49,
      unit: 'lb',
      category: 'Produce',
      isOrganic: true,
      inStock: 30,
      sku: 'ORG-APP-001',
      scalable: true,
      taxType: 'none'
    },
    {
      id: 'ground-beef',
      name: 'Ground Beef 80/20',
      image: 'https://readdy.ai/api/search-image?query=fresh%20ground%20beef%2080%2020%20lean%20meat%20package%20grocery%20store%20simple%20white%20background&width=400&height=400&seq=3&orientation=squarish',
      price: 6.99,
      unit: 'lb',
      category: 'Meat',
      inStock: 25,
      sku: 'BEEF-GRD-001',
      scalable: true,
      taxType: 'gst'
    },
    {
      id: 'whole-milk',
      name: 'Whole Milk 1L',
      image: 'https://readdy.ai/api/search-image?query=whole%20milk%20carton%201%20liter%20dairy%20fresh%20white%20package%20grocery%20store%20simple%20white%20background&width=400&height=400&seq=4&orientation=squarish',
      price: 3.49,
      unit: 'carton',
      category: 'Dairy',
      inStock: 40,
      sku: 'MILK-WHL-001',
      scalable: false,
      taxType: 'none'
    },
    {
      id: 'bread-loaf',
      name: 'Whole Wheat Bread',
      image: 'https://readdy.ai/api/search-image?query=whole%20wheat%20bread%20loaf%20sliced%20healthy%20bakery%20fresh%20package%20grocery%20store%20simple%20white%20background&width=400&height=400&seq=5&orientation=squarish',
      price: 2.79,
      unit: 'loaf',
      category: 'Bakery',
      inStock: 20,
      sku: 'BRD-WHT-001',
      scalable: false,
      taxType: 'gst_pst'
    }
  ];

  // Promo codes are now fetched from Supabase
  private promoCodes: PromoCode[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cart');
      if (stored && stored.trim()) {
        try {
          const data = JSON.parse(stored);
          this.items = data.items || [];
          this.deliveryInfo = { ...this.deliveryInfo, ...data.deliveryInfo };
          this.appliedPromo = data.appliedPromo || null;
        } catch (error) {
          console.error('Error loading cart from storage:', error);
          localStorage.removeItem('cart');
        }
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cart', JSON.stringify({
        items: this.items,
        deliveryInfo: this.deliveryInfo,
        appliedPromo: this.appliedPromo
      }));
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  addItem(product: Omit<CartItem, 'quantity'>, quantity: number = 1): boolean {
    const existingItem = this.items.find(item => item.id === product.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.inStock) {
        return false;
      }
      
      // Apply proper rounding based on scalable property
      if (product.scalable) {
        existingItem.quantity = Math.round(newQuantity * 4) / 4; // Round to nearest 0.25
      } else {
        existingItem.quantity = Math.round(newQuantity); // Round to whole number
      }
    } else {
      if (quantity > product.inStock) {
        return false;
      }
      
      // Apply proper rounding for new items
      const adjustedQuantity = product.scalable 
        ? Math.round(quantity * 4) / 4  // Round to nearest 0.25 for scalable
        : Math.round(quantity);         // Round to whole number for non-scalable
      
      this.items.push({
        ...product,
        quantity: adjustedQuantity
      });
    }
    
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  updateQuantity(id: string, quantity: number): boolean {
    const item = this.items.find(item => item.id === id);
    if (!item) return false;
    
    if (quantity <= 0) {
      this.removeItem(id);
      return true;
    }
    
    if (quantity > item.inStock) {
      return false;
    }
    
    // Apply proper rounding based on scalable property
    if (item.scalable) {
      item.quantity = Math.round(quantity * 4) / 4; // Round to nearest 0.25
    } else {
      item.quantity = Math.round(quantity); // Round to whole number
    }
    
    this.saveToStorage();
    this.notifyListeners();
    return true;
  }

  removeItem(id: string) {
    this.items = this.items.filter(item => item.id !== id);
    this.saveToStorage();
    this.notifyListeners();
  }

  clearCart() {
    this.items = [];
    this.appliedPromo = null;
    this.saveToStorage();
    this.notifyListeners();
  }

  getItems(): CartItem[] {
    return this.items;
  }

  getItemCount(): number {
    return this.items.reduce((total, item) => total + item.quantity, 0);
  }

  getSubtotal(): number {
    return this.items.reduce((total, item) => {
      const itemPrice = item.price * item.quantity;
      const bottle_price = (item.bottle_price || 0) * item.quantity;
      return total + itemPrice + bottle_price;
    }, 0);
  }

  getTax(): number {
    return this.items.reduce((totalTax, item) => {
      const itemSubtotal = item.price * item.quantity;
      let itemTax = 0;
      
      switch (item.taxType) {
        case 'gst':
          itemTax = itemSubtotal * 0.05; // 5% GST
          break;
        case 'gst_pst':
          itemTax = itemSubtotal * 0.12; // 12% GST + PST
          break;
        case 'none':
        default:
          itemTax = 0; // No tax
          break;
      }
      
      return totalTax + itemTax;
    }, 0);
  }

  getGST(): number {
    return this.items.reduce((totalGST, item) => {
      const itemSubtotal = item.price * item.quantity;
      let itemGST = 0;
      
      switch (item.taxType) {
        case 'gst':
        case 'gst_pst':
          itemGST = itemSubtotal * 0.05; // 5% GST for both types
          break;
        case 'none':
        default:
          itemGST = 0; // No GST
          break;
      }
      
      return totalGST + itemGST;
    }, 0);
  }

  getPST(): number {
    return this.items.reduce((totalPST, item) => {
      const itemSubtotal = item.price * item.quantity;
      let itemPST = 0;
      
      switch (item.taxType) {
        case 'gst_pst':
          itemPST = itemSubtotal * 0.07; // 7% PST only for gst_pst items
          break;
        case 'gst':
        case 'none':
        default:
          itemPST = 0; // No PST
          break;
      }
      
      return totalPST + itemPST;
    }, 0);
  }

  getDeliveryFee(): number {
    return this.deliveryInfo.fee; // Always return $5.00
  }

  getDiscount(): number {
    if (!this.appliedPromo) {
      return 0;
    }

    try {
      let discount = 0;
      const subtotal = this.getSubtotal();

      // Ensure discount_value is a number (handle string from database)
      const discountValue = typeof this.appliedPromo.discount_value === 'string'
        ? parseFloat(this.appliedPromo.discount_value)
        : this.appliedPromo.discount_value || 0;

      if (this.appliedPromo.discount_type === 'percentage') {
        if (isNaN(discountValue) || discountValue <= 0) {
          console.warn('⚠️ Invalid discount value in cart:', this.appliedPromo.discount_value);
          return 0;
        }
        discount = subtotal * (discountValue / 100);
        console.log('💰 Percentage discount calculated:', {
          subtotal,
          percentage: discountValue,
          discount
        });
      } else if (this.appliedPromo.discount_type === 'fixed') {
        if (isNaN(discountValue) || discountValue <= 0) {
          console.warn('⚠️ Invalid discount value in cart:', this.appliedPromo.discount_value);
          return 0;
        }
        discount = Math.min(discountValue, subtotal);
        console.log('💰 Fixed discount calculated:', { subtotal, fixed: discountValue, discount });
      } else if (this.appliedPromo.discount_type === 'free_delivery') {
        // Free delivery waives the delivery fee
        discount = this.getDeliveryFee();
        console.log('🚚 Free delivery discount applied - delivery fee waived:', { discount });
      }

      return discount;
    } catch (error) {
      console.error('❌ Error calculating discount:', error);
      return 0;
    }
  }

  getTotal(): number {
    const subtotal = this.getSubtotal();
    const tax = this.getTax();
    const deliveryFee = this.getDeliveryFee();
    const discount = this.getDiscount();
    
    return Math.max(0, subtotal + tax + deliveryFee - discount);
  }

  getDeliveryInfo(): DeliveryInfo {
    return this.deliveryInfo;
  }

  getAppliedPromo(): PromoCode | null {
    return this.appliedPromo;
  }

  updateDeliveryInfo(postalCode: string) {
    this.deliveryInfo.postalCode = postalCode;
    
    // Set flat delivery fee and standard time for all locations
    this.deliveryInfo.estimatedTime = 'Next available slot';
    this.deliveryInfo.fee = 5.00;
    
    this.saveToStorage();
    this.notifyListeners();
  }

  applyPromoCode(promoCode: PromoCode): { success: boolean; message: string } {
    // Check if promo is already applied
    if (this.appliedPromo?.code === promoCode.code) {
      console.warn('⚠️ Promo code already applied:', promoCode.code);
      return { success: false, message: 'Promo code already applied' };
    }

    console.log('💾 Storing promo code in cart:', {
      code: promoCode.code,
      discount_type: promoCode.discount_type,
      discount_value: promoCode.discount_value
    });

    this.appliedPromo = promoCode;
    this.saveToStorage();
    this.notifyListeners();

    const currentDiscount = this.getDiscount();
    console.log('✅ Promo code stored. Current discount:', currentDiscount);

    return { success: true, message: `${promoCode.description || promoCode.code} applied!` };
  }

  removePromoCode() {
    this.appliedPromo = null;
    this.saveToStorage();
    this.notifyListeners();
  }

  addItemByName(productName: string, quantity: number = 1): { success: boolean; message: string } {
    const product = this.mockProducts.find(p => 
      p.name.toLowerCase().includes(productName.toLowerCase())
    );
    
    if (!product) {
      return { success: false, message: `Product "${productName}" not found` };
    }
    
    const success = this.addItem(product, quantity);
    if (success) {
      return { success: true, message: `Added ${quantity} ${product.unit} of ${product.name} to cart` };
    } else {
      return { success: false, message: `Not enough stock for ${product.name}` };
    }
  }

  getCartSummary(): string {
    const itemCount = this.getItemCount();
    const total = this.getTotal();
    
    if (itemCount === 0) {
      return "Your cart is empty";
    }
    
    return `Cart: ${itemCount} items, Total: $${total.toFixed(2)}`;
  }
}

export const cartStore = new CartStore();
