import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db-client';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { affiliate_code, order_id } = body;
  if (!affiliate_code || !order_id) {
    return NextResponse.json({ error: 'affiliate_code and order_id are required' }, { status: 400 });
  }

  const db = getDbClient();

  const link = await db.queryOne<any>(`
    SELECT tl.id, COALESCE(c.revenue_share, 0) as revenue_share
    FROM tracking_links tl
    LEFT JOIN contracts c ON tl.contract_id = c.id
    WHERE tl.code = ?
  `, [affiliate_code.toUpperCase()]);

  if (!link) {
    return NextResponse.json({ error: 'affiliate_code not found' }, { status: 404 });
  }

  const order = await db.queryOne<any>(
    'SELECT id, total_price, commission FROM cafe24_synced_orders WHERE order_id = ?',
    [order_id]
  );

  if (!order) {
    return NextResponse.json({ matched: false, message: 'order not yet synced' });
  }

  const commission = Math.round(parseFloat(order.total_price) * link.revenue_share / 100);

  await db.run(`
    UPDATE cafe24_synced_orders
    SET link_id = ?, commission = ?, is_attributed = 1, affiliate_code = ?
    WHERE order_id = ?
  `, [link.id, commission, affiliate_code.toUpperCase(), order_id]);

  const already = await db.queryOne(
    'SELECT id FROM conversions WHERE order_id = ? AND link_id = ?',
    [order_id, link.id]
  );
  if (!already) {
    await db.run(`
      INSERT INTO conversions (link_id, order_id, amount, commission)
      VALUES (?, ?, ?, ?)
    `, [link.id, order_id, parseFloat(order.total_price), commission]);
  }

  return NextResponse.json({ matched: true, link_id: link.id, commission });
}
