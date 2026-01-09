import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '../../../../lib/supabase';

interface PromoCode {
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

function calculateDiscount(promoCode: PromoCode, cartSubtotal: number): number {
  if (promoCode.discount_type === 'fixed') {
    return promoCode.discount_value;
  } else if (promoCode.discount_type === 'percentage') {
    return (cartSubtotal * promoCode.discount_value) / 100;
  }
  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const { code, subtotal, userId } = await request.json();

    console.log('🔍 Starting promo code validation:', { code: code.trim(), subtotal, userId });

    const supabase = await supabaseServer();

    const { data: promoCode, error: fetchError } = await supabase
      .from('promo_codes')
      .select('*')
      .ilike('code', code.trim())
      .maybeSingle();

    console.log('📦 Fetch result:', { fetchError, promoCode });

    if (fetchError || !promoCode) {
      console.warn('❌ Promo code not found in database');
      return NextResponse.json({
        success: false,
        message: 'Invalid promo code'
      });
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
      return NextResponse.json({
        success: false,
        message: 'This promo code is no longer active'
      });
    }

    // Check date validity
    const now = new Date();
    if (promoCode.start_date) {
      const startDate = new Date(promoCode.start_date);
      console.log('📅 Start date check:', { start_date: promoCode.start_date, now, isValid: startDate <= now });
      if (startDate > now) {
        console.warn('❌ Promo code not yet valid');
        return NextResponse.json({
          success: false,
          message: 'This promo code is not yet valid'
        });
      }
    }

    if (promoCode.end_date) {
      const endDate = new Date(promoCode.end_date);
      console.log('📅 End date check:', { end_date: promoCode.end_date, now, isExpired: endDate < now });
      if (endDate < now) {
        console.warn('❌ Promo code has expired (end_date)');
        return NextResponse.json({
          success: false,
          message: 'This promo code has expired'
        });
      }
    }

    if (promoCode.expires_at) {
      const expiresAt = new Date(promoCode.expires_at);
      console.log('📅 Expires at check:', { expires_at: promoCode.expires_at, now, isExpired: expiresAt < now });
      if (expiresAt < now) {
        console.warn('❌ Promo code has expired (expires_at)');
        return NextResponse.json({
          success: false,
          message: 'This promo code has expired'
        });
      }
    }

    // Check minimum order amount
    if (promoCode.min_order_amount && subtotal < promoCode.min_order_amount) {
      console.warn('❌ Cart subtotal below minimum:', { min_required: promoCode.min_order_amount, current: subtotal });
      return NextResponse.json({
        success: false,
        message: `Minimum order amount of $${promoCode.min_order_amount} required for this promo code`
      });
    }

    // Check usage limit
    if (promoCode.max_uses && promoCode.current_uses !== undefined && promoCode.current_uses !== null) {
      console.log('🔄 Usage limit check:', { max_uses: promoCode.max_uses, current_uses: promoCode.current_uses });
      if (promoCode.current_uses >= promoCode.max_uses) {
        console.warn('❌ Promo code usage limit reached');
        return NextResponse.json({
          success: false,
          message: 'This promo code has reached its usage limit'
        });
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
        return NextResponse.json({
          success: false,
          message: 'You have reached the usage limit for this promo code'
        });
      }
    }

    // Calculate discount
    const discount = calculateDiscount(promoCode, subtotal);
    console.log('💰 Discount calculated:', { discount, discount_type: promoCode.discount_type, discount_value: promoCode.discount_value });

    // Return validated promo code
    console.log('✨ Promo code validation successful!');
    return NextResponse.json({
      success: true,
      message: `${promoCode.code} applied successfully!`,
      promoCode,
      discount
    });
  } catch (error: any) {
    console.error('❌ Exception during promo code validation:', error);
    return NextResponse.json({
      success: false,
      message: 'Error validating promo code'
    });
  }
}