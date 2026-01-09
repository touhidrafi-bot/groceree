import { supabase } from './auth';

export interface PromoCode {
  id?: string;
  code: string;
  description?: string | null;
  discount_type: string | null;
  discount_value: number;
  min_order_amount?: number | null;
  max_uses?: number | null;
  current_uses?: number | null;
  uses_per_user_limit?: number | null;
  is_active?: boolean | null;
  is_public?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
}

export interface PromoCodeUsage {
  id?: string;
  promo_code_id: string | null;
  order_id?: string | null;
  user_id?: string | null;
  discount_amount: number;
  used_at?: string | null;
}

export interface PromoCodeValidation {
  success: boolean;
  message: string;
  promoCode?: PromoCode;
  discount?: number;
}

export class PromocodeService {
  /**
   * Fetch a promo code from Supabase and validate it
   */
  static async validatePromoCode(
    code: string,
    cartSubtotal: number,
    userId?: string
  ): Promise<PromoCodeValidation> {
    try {
      console.log('🔍 Starting promo code validation:', { code: code.trim(), cartSubtotal, userId });

      const { data: promoCode, error: fetchError } = await supabase
        .from('promo_codes')
        .select('*')
        .ilike('code', code.trim())
        .maybeSingle();

      console.log('📦 Fetch result:', { fetchError, promoCode });

      if (fetchError || !promoCode) {
        console.warn('❌ Promo code not found in database');
        return {
          success: false,
          message: 'Invalid promo code'
        };
      }

      console.log('✅ Promo code found:', {
        code: promoCode.code,
        is_active: promoCode.is_active,
        discount_type: promoCode.discount_type,
        discount_value: promoCode.discount_value
      });

      // Check if promo code is active
      if (promoCode.is_active === false) {
        console.warn('❌ Promo code is not active');
        return {
          success: false,
          message: 'This promo code is no longer active'
        };
      }

      // Check date validity
      const now = new Date();
      if (promoCode.start_date) {
        const startDate = new Date(promoCode.start_date);
        console.log('📅 Start date check:', { start_date: promoCode.start_date, now, isValid: startDate <= now });
        if (startDate > now) {
          console.warn('❌ Promo code not yet valid');
          return {
            success: false,
            message: 'This promo code is not yet valid'
          };
        }
      }

      if (promoCode.end_date) {
        const endDate = new Date(promoCode.end_date);
        console.log('📅 End date check:', { end_date: promoCode.end_date, now, isExpired: endDate < now });
        if (endDate < now) {
          console.warn('❌ Promo code has expired (end_date)');
          return {
            success: false,
            message: 'This promo code has expired'
          };
        }
      }

      if (promoCode.expires_at) {
        const expiresAt = new Date(promoCode.expires_at);
        console.log('📅 Expires at check:', { expires_at: promoCode.expires_at, now, isExpired: expiresAt < now });
        if (expiresAt < now) {
          console.warn('❌ Promo code has expired (expires_at)');
          return {
            success: false,
            message: 'This promo code has expired'
          };
        }
      }

      // Check minimum order amount
      if (promoCode.min_order_amount && cartSubtotal < promoCode.min_order_amount) {
        console.warn('❌ Cart subtotal below minimum:', { min_required: promoCode.min_order_amount, current: cartSubtotal });
        return {
          success: false,
          message: `Minimum order amount of $${promoCode.min_order_amount} required for this promo code`
        };
      }

      // Check usage limit
      if (promoCode.max_uses && promoCode.current_uses !== undefined && promoCode.current_uses !== null) {
        console.log('🔄 Usage limit check:', { max_uses: promoCode.max_uses, current_uses: promoCode.current_uses });
        if (promoCode.current_uses >= promoCode.max_uses) {
          console.warn('❌ Promo code usage limit reached');
          return {
            success: false,
            message: 'This promo code has reached its usage limit'
          };
        }
      }

      // Check per-user usage limit (if applicable)
      if (userId && promoCode.uses_per_user_limit) {
        const { data: userUsageData, error: userUsageError } = await supabase
          .from('promo_code_usage')
          .select('id', { count: 'exact' })
          .eq('promo_code_id', promoCode.id)
          .eq('user_id', userId);

        const usageCount = userUsageData?.length || 0;
        console.log('👤 Per-user usage check:', { limit: promoCode.uses_per_user_limit, used: usageCount });

        if (userUsageError) {
          console.warn('⚠️ Error checking user usage:', userUsageError);
        } else if (usageCount >= promoCode.uses_per_user_limit) {
          console.warn('❌ User has reached usage limit');
          return {
            success: false,
            message: 'You have reached the usage limit for this promo code'
          };
        }
      }

      // Calculate discount
      const discount = this.calculateDiscount(promoCode, cartSubtotal);
      console.log('💰 Discount calculated:', { discount, discount_type: promoCode.discount_type, discount_value: promoCode.discount_value });

      // Return validated promo code
      console.log('✨ Promo code validation successful!');
      return {
        success: true,
        message: `${promoCode.code} applied successfully!`,
        promoCode,
        discount
      };
    } catch (error: any) {
      console.error('❌ Exception during promo code validation:', error);
      return {
        success: false,
        message: 'Error validating promo code'
      };
    }
  }

  /**
   * Track promo code usage
   */
  static async trackPromoCodeUsage(
    promoCodeId: string,
    discountAmount: number,
    _userId?: string,
    orderId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('promo_code_usage')
        .insert({
          promo_code_id: promoCodeId,
          user_id: _userId,
          order_id: orderId,
          discount_amount: discountAmount,
          used_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error tracking promo code usage:', error);
        return {
          success: false,
          message: 'Error tracking promo code usage'
        };
      }

      // Update current_uses count
      const { data: currentPromo } = await supabase
        .from('promo_codes')
        .select('current_uses')
        .eq('id', promoCodeId)
        .single();

      if (currentPromo) {
        await supabase
          .from('promo_codes')
          .update({ current_uses: (currentPromo.current_uses || 0) + 1 })
          .eq('id', promoCodeId);
      }

      return {
        success: true,
        message: 'Promo code usage tracked'
      };
    } catch (error: any) {
      console.error('Error tracking promo code usage:', error);
      return {
        success: false,
        message: 'Error tracking promo code usage'
      };
    }
  }

  /**
   * Get all available promo codes for display
   */
  static async getAvailablePromoCodes(): Promise<PromoCode[]> {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('promo_codes')
        .select('id, code, description, discount_type, discount_value, is_public, is_active, start_date, end_date')
        .eq('is_active', true)
        .eq('is_public', true)
        // start_date is null OR start_date <= now
        .or(`start_date.is.null,start_date.lte.${now}`)
        // end_date is null OR end_date >= now
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching available promo codes:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching available promo codes:', error);
      return [];
    }
  }

  /**
   * Get all promo codes (for admin)
   */
  static async getAllPromoCodes(_userId?: string): Promise<PromoCode[]> {
    try {
      console.log('📚 Fetching all promo codes');
      const response = await fetch('/api/admin/promo-codes');
      if (!response.ok) {
        throw new Error('Failed to fetch promo codes');
      }
      const data = await response.json();
      console.log('✅ Fetched promo codes:', data?.length || 0, 'codes');
      return data || [];
    } catch (error: any) {
      console.error('❌ Exception fetching promo codes:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      return [];
    }
  }

  /**
   * Get promo code by ID
   */
  static async getPromoCodeById(id: string): Promise<PromoCode | null> {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching promo code:', error);
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('Error fetching promo code:', error);
      return null;
    }
  }

  /**
   * Create a new promo code
   */
  static async createPromoCode(
    promoCode: PromoCode,
    userId?: string
  ): Promise<{ success: boolean; message: string; promoCode?: PromoCode }> {
    try {
      console.log('➕ Creating promo code:', {
        code: promoCode.code,
        discount_type: promoCode.discount_type,
        discount_value: promoCode.discount_value,
        created_by: userId
      });

      const insertData = {
        code: promoCode.code.toUpperCase().trim(),
        description: promoCode.description || null,
        discount_type: promoCode.discount_type,
        discount_value: promoCode.discount_value,
        min_order_amount: promoCode.min_order_amount || 0,
        max_uses: promoCode.max_uses || null,
        current_uses: 0,
        uses_per_user_limit: promoCode.uses_per_user_limit || null,
        is_active: promoCode.is_active !== false,
        is_public: promoCode.is_public || false,
        start_date: promoCode.start_date || null,
        end_date: promoCode.end_date || null,
        expires_at: promoCode.expires_at || null,
        created_by: userId || null
      };

      console.log('📊 Insert data:', insertData);

      const response = await fetch('/api/admin/promo-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(insertData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error || 'Failed to create promo code'
        };
      }

      const data = await response.json();

      console.log('✅ Promo code created successfully:', data);
      return {
        success: true,
        message: 'Promo code created successfully',
        promoCode: data
      };
    } catch (error: any) {
      console.error('❌ Exception creating promo code:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        details: error?.details,
        fullError: JSON.stringify(error, null, 2)
      });
      return {
        success: false,
        message: error?.message || 'Error creating promo code'
      };
    }
  }

  /**
   * Update promo code
   */
  static async updatePromoCode(
    id: string,
    updates: Partial<PromoCode>
  ): Promise<{ success: boolean; message: string; promoCode?: PromoCode }> {
    try {
      console.log('✏️ Updating promo code:', { id, updates });

      const updateData: any = {};

      if (updates.code !== undefined) updateData.code = updates.code.toUpperCase().trim();
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.discount_type !== undefined) updateData.discount_type = updates.discount_type;
      if (updates.discount_value !== undefined) updateData.discount_value = updates.discount_value;
      if (updates.min_order_amount !== undefined) updateData.min_order_amount = updates.min_order_amount;
      if (updates.max_uses !== undefined) updateData.max_uses = updates.max_uses;
      if (updates.uses_per_user_limit !== undefined) updateData.uses_per_user_limit = updates.uses_per_user_limit;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.is_public !== undefined) updateData.is_public = updates.is_public;
      if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if (updates.expires_at !== undefined) updateData.expires_at = updates.expires_at;

      updateData.updated_at = new Date().toISOString();

      console.log('📊 Update data:', updateData);

      const response = await fetch('/api/admin/promo-codes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updateData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error || 'Failed to update promo code'
        };
      }

      const data = await response.json();

      console.log('✅ Promo code updated successfully:', data);
      return {
        success: true,
        message: 'Promo code updated successfully',
        promoCode: data
      };
    } catch (error: any) {
      console.error('❌ Exception updating promo code:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      return {
        success: false,
        message: error?.message || 'Error updating promo code'
      };
    }
  }

  /**
   * Delete promo code
   */
  static async deletePromoCode(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`/api/admin/promo-codes?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error || 'Failed to delete promo code'
        };
      }

      return {
        success: true,
        message: 'Promo code deleted successfully'
      };
    } catch (error: any) {
      console.error('Error deleting promo code:', error);
      return {
        success: false,
        message: 'Error deleting promo code'
      };
    }
  }

  /**
   * Get usage stats for a promo code
   */
  static async getPromoCodeUsageStats(
    promoCodeId: string
  ): Promise<{ total: number; users: number; recentUsage: PromoCodeUsage[] }> {
    try {
      const response = await fetch(`/api/admin/promo-codes/usage?id=${promoCodeId}`);
      if (!response.ok) {
        return { total: 0, users: 0, recentUsage: [] };
      }
      return await response.json();
    } catch (error: any) {
      console.error('Error fetching usage stats:', error);
      return { total: 0, users: 0, recentUsage: [] };
    }
  }

  /**
   * Calculate discount amount
   */
  static calculateDiscount(
    promoCode: PromoCode,
    subtotal: number,
    deliveryFee: number = 5.00
  ): number {
    try {
      if (!promoCode.discount_type) {
        console.warn('⚠️ No discount type specified');
        return 0;
      }

      if (promoCode.discount_type === 'percentage') {
        // Ensure discount_value is a number
        const discountValue = typeof promoCode.discount_value === 'string'
          ? parseFloat(promoCode.discount_value)
          : promoCode.discount_value || 0;

        if (isNaN(discountValue) || discountValue <= 0) {
          console.warn('⚠️ Invalid discount value:', promoCode.discount_value);
          return 0;
        }

        const discount = subtotal * (discountValue / 100);
        console.log('💰 Percentage discount:', { subtotal, percentage: discountValue, result: discount });
        return discount;
      } else if (promoCode.discount_type === 'fixed') {
        // Ensure discount_value is a number
        const discountValue = typeof promoCode.discount_value === 'string'
          ? parseFloat(promoCode.discount_value)
          : promoCode.discount_value || 0;

        if (isNaN(discountValue) || discountValue <= 0) {
          console.warn('⚠️ Invalid discount value:', promoCode.discount_value);
          return 0;
        }

        const discount = Math.min(discountValue, subtotal);
        console.log('💰 Fixed discount:', { subtotal, fixed: discountValue, result: discount });
        return discount;
      } else if (promoCode.discount_type === 'free_delivery') {
        console.log('🚚 Free delivery - waiving delivery fee:', { deliveryFee });
        return deliveryFee;
      }

      console.warn('⚠️ Unknown discount type:', promoCode.discount_type);
      return 0;
    } catch (error) {
      console.error('❌ Error calculating discount:', error);
      return 0;
    }
  }
}
