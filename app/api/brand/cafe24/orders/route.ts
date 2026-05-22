import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbClient } from '@/lib/db-client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.role !== 'brand') {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const credentialId = searchParams.get('credential_id');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  const db = getDbClient();

  const ordersParams = credentialId ? [user.id, credentialId, limit] : [user.id, limit];
  const orders = await db.query(`
    SELECT
      so.id, so.order_id, so.order_date, so.buyer_name,
      so.total_price, so.affiliate_code, so.commission,
      so.is_attributed, so.synced_at,
      tl.title as link_title, tl.code as link_code
    FROM cafe24_synced_orders so
    JOIN cafe24_credentials cc ON so.credential_id = cc.id
    LEFT JOIN tracking_links tl ON so.link_id = tl.id
    WHERE cc.user_id = ? ${credentialId ? 'AND cc.id = ?' : ''}
    ORDER BY so.synced_at DESC
    LIMIT ?
  `, ordersParams);

  const statsParams = credentialId ? [user.id, credentialId] : [user.id];
  const stats = await db.queryOne(`
    SELECT
      COUNT(*) as total_orders,
      SUM(CASE WHEN is_attributed = 1 THEN 1 ELSE 0 END) as attributed_orders,
      COALESCE(SUM(total_price), 0) as total_sales,
      COALESCE(SUM(commission), 0) as total_commission
    FROM cafe24_synced_orders so
    JOIN cafe24_credentials cc ON so.credential_id = cc.id
    WHERE cc.user_id = ? ${credentialId ? 'AND cc.id = ?' : ''}
  `, statsParams) as any;

  return NextResponse.json({ orders, stats });
}
