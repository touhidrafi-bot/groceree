import { supabase } from './auth';

export interface PaymentSettings {
  id: number;
  stripe_enabled: boolean;
  interac_enabled: boolean;
  updated_at: string;
}

const CACHE_KEY = 'payment-settings-cache';
const CACHE_DURATION = 30000; // 30 seconds

interface CachedSettings {
  data: PaymentSettings;
  timestamp: number;
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  try {
    // Check cache first (only in browser)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached) as CachedSettings;
          const now = Date.now();
          if (now - cachedData.timestamp < CACHE_DURATION) {
            return cachedData.data;
          }
        } catch (e) {
          // Cache is invalid, continue fetching
        }
      }
    }

    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching payment settings:', error);
      // Return default settings if fetch fails
      return {
        id: 0,
        stripe_enabled: true,
        interac_enabled: true,
        updated_at: new Date().toISOString(),
      };
    }

    // Cache the settings in browser
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        } as CachedSettings)
      );
    }

    return data;
  } catch (error) {
    console.error('Unexpected error fetching payment settings:', error);
    // Return default settings on any error
    return {
      id: 0,
      stripe_enabled: true,
      interac_enabled: true,
      updated_at: new Date().toISOString(),
    };
  }
}

export function clearPaymentSettingsCache() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
  }
}
