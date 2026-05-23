const CAFE24_API_VERSION = '2024-06-01';

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  refresh_token_expires_at?: string;
  token_type?: string;
  client_id?: string;
  mall_id?: string;
}

export function getAuthorizationUrl(
  mallId: string,
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'mall.read_order',
    state,
  });
  return `https://${mallId}.cafe24api.com/api/v2/oauth/authorize?${params}`;
}

export async function getAccessTokenByCode(
  mallId: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const msg = err.error_description ?? err.error ?? `인증 실패 (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data.expires_at) {
    data.expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }
  return data as TokenResponse;
}

export async function refreshAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<TokenResponse> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    const msg = err.error_description ?? err.error ?? `토큰 재발급 실패 (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data.expires_at) {
    data.expires_at = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }
  return data as TokenResponse;
}

/** @deprecated refreshAccessToken 사용 권장 */
export async function getAccessToken(
  mallId: string,
  clientId: string,
  clientSecret: string,
  refreshToken?: string
): Promise<TokenResponse> {
  if (!refreshToken) throw new Error('refresh_token이 필요합니다.');
  return refreshAccessToken(mallId, clientId, clientSecret, refreshToken);
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
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Cafe24 API error: ${res.status} - ${errBody}`);
  }
  return res.json();
}

export function extractAffiliateCode(order: Cafe24Order): string | null {
  if (order.affiliate_code) return order.affiliate_code.toUpperCase();
  for (const urlStr of [order.referral_url, order.first_referral_url]) {
    if (!urlStr) continue;
    try {
      const url = new URL(urlStr);
      const pathMatch = url.pathname.match(/\/api\/track\/([A-Z0-9]+)/i);
      if (pathMatch) return pathMatch[1].toUpperCase();
      const utm = url.searchParams.get('utm_campaign');
      if (utm) return utm.toUpperCase();
      const aff = url.searchParams.get('affiliate_code');
      if (aff) return aff.toUpperCase();
    } catch { /* invalid URL */ }
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
    const sep = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${sep}affiliate_code=${code}&utm_source=affiliate&utm_campaign=${code}`;
  }
}
