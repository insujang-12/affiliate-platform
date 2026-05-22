import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getOrders, getAccessToken, extractAffiliateCode } from '@/lib/cafe24';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.role !== 'brand') {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { credential_id } = await req.json().catch(() => ({}));
  const db = getDb();

  const credQuery = credential_id
    ? 'SELECT * FROM cafe24_credentials WHERE id = ? AND user_id = ? AND is_connected = 1'
    : 'SELECT * FROM cafe24_credentials WHERE user_id = ? AND is_connected = 1 LIMIT 1';

  const cred = (credential_id
    ? db.prepare(credQuery).get(credential_id, user.id)
    : db.prepare(credQuery).get(user.id)) as any;

  if (!cred) {
    return NextResponse.json({ error: '연결된 카페24 계정이 없습니다.' }, { status: 400 });
  }

  let accessToken = cred.access_token;

  // Re-issue token if expired or within 10 minutes of expiry
  const shouldRefresh = !cred.token_expires_at ||
    new Date(cred.token_expires_at).getTime() - Date.now() < 10 * 60 * 1000;

  if (shouldRefresh) {
    try {
      const tokens = await getAccessToken(cred.mall_id, cred.client_id, cred.client_secret);
      accessToken = tokens.access_token;
      db.prepare(`
        UPDATE cafe24_credentials
        SET access_token = ?, token_expires_at = ?
        WHERE id = ?
      `).run(tokens.access_token, tokens.expires_at, cred.id);
    } catch (err: any) {
      db.prepare('UPDATE cafe24_credentials SET is_connected = 0 WHERE id = ?').run(cred.id);
      return NextResponse.json({
        error: `토큰 재발급 실패: ${err.message ?? 'API 인증 오류'}`,
      }, { status: 401 });
    }
  }

  // Date range: last sync - 1h → today, fallback to last 7 days
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = cred.last_synced_at
    ? new Date(new Date(cred.last_synced_at).getTime() - 60 * 60 * 1000)
        .toISOString().split('T')[0]
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let syncedCount = 0;
  let attributedCount = 0;

  try {
    const result = await getOrders(cred.mall_id, accessToken, {
      start_date: startDate,
      end_date: endDate,
      limit: 100,
    });

    const orders = result.orders ?? [];

    const insertOrder = db.prepare(`
      INSERT OR IGNORE INTO cafe24_synced_orders
        (credential_id, order_id, order_date, buyer_name, total_price,
         affiliate_code, link_id, commission, is_attributed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertConversion = db.prepare(`
      INSERT INTO conversions (link_id, order_id, amount, commission, converted_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const processOrders = db.transaction((orders: any[]) => {
      for (const order of orders) {
        const affiliateCode = extractAffiliateCode(order);
        const totalPrice = parseFloat(order.actual_payment_amount || order.total_price || '0');

        let linkId: number | null = null;
        let commission = 0;
        let isAttributed = 0;

        if (affiliateCode) {
          const link = db.prepare(`
            SELECT tl.id, COALESCE(c.revenue_share, 0) as revenue_share
            FROM tracking_links tl
            LEFT JOIN contracts c ON tl.contract_id = c.id
            WHERE tl.code = ?
          `).get(affiliateCode) as any;

          if (link) {
            linkId = link.id;
            commission = Math.round(totalPrice * link.revenue_share / 100);
            isAttributed = 1;
          }
        }

        const inserted = insertOrder.run(
          cred.id, order.order_id, order.order_date, order.buyer_name,
          totalPrice, affiliateCode, linkId, commission, isAttributed
        );

        if (inserted.changes > 0) {
          syncedCount++;
          if (isAttributed && linkId) {
            attributedCount++;
            const already = db.prepare(
              'SELECT id FROM conversions WHERE order_id = ? AND link_id = ?'
            ).get(order.order_id, linkId);
            if (!already) {
              insertConversion.run(linkId, order.order_id, totalPrice, commission, order.order_date);
            }
          }
        }
      }
    });

    processOrders(orders);

    db.prepare("UPDATE cafe24_credentials SET last_synced_at = datetime('now') WHERE id = ?")
      .run(cred.id);

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      attributed: attributedCount,
      total_fetched: orders.length,
    });
  } catch (err: any) {
    console.error('Cafe24 sync error:', err);
    return NextResponse.json({ error: err.message ?? '동기화 실패' }, { status: 500 });
  }
}
