import { NextResponse } from 'next/server';
import { supabaseServer } from '../../../../../lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const promoCodeId = searchParams.get('id');

    if (!promoCodeId) {
      return NextResponse.json({ error: 'Promo code ID required' }, { status: 400 });
    }

    const supabase = await supabaseServer();

    const { data: usageData, error: usageError } = await supabase
      .from('promo_code_usage')
      .select('*')
      .eq('promo_code_id', promoCodeId)
      .order('used_at', { ascending: false })
      .limit(10);

    if (usageError) {
      console.error('Error fetching usage stats:', usageError);
      return NextResponse.json({ total: 0, users: 0, recentUsage: [] });
    }

    const { count: uniqueUsers } = await supabase
      .from('promo_code_usage')
      .select('user_id', { count: 'exact', head: true })
      .eq('promo_code_id', promoCodeId);

    return NextResponse.json({
      total: usageData?.length || 0,
      users: uniqueUsers || 0,
      recentUsage: usageData || []
    });
  } catch (error: any) {
    console.error('Error fetching usage stats:', error);
    return NextResponse.json({ total: 0, users: 0, recentUsage: [] });
  }
}