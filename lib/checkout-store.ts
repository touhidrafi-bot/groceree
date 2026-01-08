// Checkout state persistence utility for resilient checkout experience

interface CheckoutState {
  currentStep: number;
  selectedDeliverySlot: any | null;
  tipAmount: number;
  customTipAmount: string;
  paymentMethod: 'card' | 'interac';
  form: {
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
  };
}

const CHECKOUT_STORAGE_KEY = 'groceree-checkout-state';
const CHECKOUT_STORAGE_VERSION = '1';

export class CheckoutStore {
  private defaultForm = {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    apartment: '',
    city: 'Vancouver',
    province: 'BC',
    postalCode: '',
    deliveryInstructions: '',
    saveInfo: false,
  };

  private defaultState: CheckoutState = {
    currentStep: 1,
    selectedDeliverySlot: null,
    tipAmount: 0,
    customTipAmount: '',
    paymentMethod: 'card',
    form: this.defaultForm,
  };

  // Load state from localStorage
  loadState(): CheckoutState {
    if (typeof window === 'undefined') {
      return this.defaultState;
    }

    try {
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (!stored) return this.defaultState;

      const parsed = JSON.parse(stored);

      // Validate version
      if (parsed.version !== CHECKOUT_STORAGE_VERSION) {
        localStorage.removeItem(CHECKOUT_STORAGE_KEY);
        return this.defaultState;
      }

      // Merge with defaults to handle missing fields
      return {
        currentStep: parsed.state?.currentStep ?? this.defaultState.currentStep,
        selectedDeliverySlot: parsed.state?.selectedDeliverySlot ?? null,
        tipAmount: Number(parsed.state?.tipAmount ?? 0),
        customTipAmount: parsed.state?.customTipAmount ?? '',
        paymentMethod: parsed.state?.paymentMethod ?? 'card',
        form: {
          ...this.defaultForm,
          ...parsed.state?.form,
        },
      };
    } catch (error) {
      console.warn('Error loading checkout state from storage:', error);
      return this.defaultState;
    }
  }

  // Save state to localStorage
  saveState(state: Partial<CheckoutState>) {
    if (typeof window === 'undefined') return;

    try {
      const current = this.loadState();
      const merged = { ...current, ...state };
      localStorage.setItem(
        CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          version: CHECKOUT_STORAGE_VERSION,
          state: merged,
          timestamp: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.warn('Error saving checkout state:', error);
    }
  }

  // Update specific form fields
  updateForm(updates: Partial<CheckoutState['form']>) {
    const current = this.loadState();
    this.saveState({
      form: { ...current.form, ...updates },
    });
  }

  // Update delivery slot
  setDeliverySlot(slot: any) {
    this.saveState({ selectedDeliverySlot: slot });
  }

  // Update tip amount
  setTipAmount(amount: number, customAmount: string = '') {
    this.saveState({ tipAmount: amount, customTipAmount: customAmount });
  }

  // Update current step
  setCurrentStep(step: number) {
    this.saveState({ currentStep: step });
  }

  // Update payment method
  setPaymentMethod(method: 'card' | 'interac') {
    this.saveState({ paymentMethod: method });
  }

  // Clear all checkout state (after successful order)
  clearState() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    } catch (error) {
      console.warn('Error clearing checkout state:', error);
    }
  }

  // Clear sensitive data (payment method, card info) but keep address/contact
  clearSensitiveData() {
    const _current = this.loadState();
    this.saveState({
      paymentMethod: 'card',
      tipAmount: 0,
      customTipAmount: '',
    });
  }
}

export const checkoutStore = new CheckoutStore();
