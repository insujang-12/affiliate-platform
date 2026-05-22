import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbClient } from '@/lib/db-client';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const userId = (session.user as any).id;
  const db = getDbClient();

  const contracts = await db.query(`
    SELECT
      c.*,
      COUNT(DISTINCT tl.id) as link_count,
      COALESCE(SUM(cv.commission), 0) as total_commission
    FROM contracts c
    LEFT JOIN tracking_links tl ON c.id = tl.contract_id
    LEFT JOIN conversions cv ON tl.id = cv.link_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `, [userId]);

  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const userId = (session.user as any).id;
  const { brand_name, revenue_share, start_date, end_date } = await req.json();

  if (!brand_name || revenue_share == null || !start_date || !end_date) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }

  const db = getDbClient();
  const result = await db.run(`
    INSERT INTO contracts (user_id, brand_name, revenue_share, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, brand_name, parseFloat(revenue_share), start_date, end_date]);

  return NextResponse.json({ id: result.lastId });
}
