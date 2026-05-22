const CAFE24_API_VERSION = '2024-06-01';

export interface TokenResponse {
  access_token: string;
  expires_at: string;
  token_type?: string;
  client_id?: string;
  mall_id?: string;
}

/**
 * Get access token using client_credentials grant.
 * Cafe24 자체 개발앱(관리자에서 발급한 Client ID/Secret) 전용.
 * OAuth redirect 없이 서버간 직접 인증.
 */
export async function getAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'mall.read_order',
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const msg = err.error_description ?? err.error ?? `인증 실패 (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();

  // Fallback: Cafe24가 expires_at를 생략하는 경우 2시간 후로 설정
  if (!data.expires_at) {
    data.expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }

  return data as TokenResponse;
}

export interface Cafe24Order {
  order_id: string;
  order_date: string;
  buyer_name: string;
  actual_payment_amount: string;
  total_price: string;
  affiliate_code: string | null;
  referral_url: string | null;
  first_referral_url: string | null;
}

export async function getOrders(
  mallId: string,
  accessToken: string,
  options: { start_date?: string; end_date?: string; limit?: number; offset?: number } = {}
): Promise<{ orders: Cafe24Order[]; total_count: number }> {
  const params = new URLSearchParams();
  if (options.start_date) params.set('start_date', options.start_date);
  if (options.end_date) params.set('end_date', options.end_date);
  params.set('limit', String(options.limit ?? 100));
  params.set('offset', String(options.offset ?? 0));

  const res = await fetch(`https://${mallId}.cafe24api.com/api/v2/admin/orders?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Cafe24-Api-Version': CAFE24_API_VERSION,
    },
  });

  if (!res.ok) throw new Error(`Cafe24 API error: ${res.status}`);
  return res.json();
}

export function extractAffiliateCode(order: Cafe24Order): string | null {
  // 1. Cafe24 built-in affiliate_code field (most reliable)
  if (order.affiliate_code) return order.affiliate_code.toUpperCase();

  // 2. Look for our tracking link pattern in referral URLs
  for (const urlStr of [order.referral_url, order.first_referral_url]) {
    if (!urlStr) continue;
    try {
      const url = new URL(urlStr);
      // /api/track/{CODE} pattern
      const pathMatch = url.pathname.match(/\/api\/track\/([A-Z0-9]+)/i);
      if (pathMatch) return pathMatch[1].toUpperCase();
      // utm_campaign param
      const utm = url.searchParams.get('utm_campaign');
      if (utm) return utm.toUpperCase();
      // affiliate_code query param
      const aff = url.searchParams.get('affiliate_code');
      if (aff) return aff.toUpperCase();
    } catch {
      // invalid URL
    }
  }

  return null;
}

export function addAffiliateCodeToUrl(originalUrl: string, code: string): string {
  try {
    const url = new URL(originalUrl);
    url.searchParams.set('affiliate_code', code);
    url.searchParams.set('utm_source', 'affiliate');
    url.searchParams.set('utm_campaign', code);
    return url.toString();
  } catch {
    // If URL parsing fails, append as-is
    const sep = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${sep}affiliate_code=${code}&utm_source=affiliate&utm_campaign=${code}`;
  }
}
