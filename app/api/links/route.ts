import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbClient } from '@/lib/db-client';
import { generateCode } from '@/lib/utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const userId = (session.user as any).id;
  const db = getDbClient();
  const links = await db.query(`
    SELECT
      tl.id, tl.title, tl.original_url, tl.code, tl.created_at,
      c.brand_name, c.revenue_share,
      COUNT(DISTINCT cl.id) as click_count,
      COUNT(DISTINCT cv.id) as conversion_count,
      COALESCE(SUM(cv.commission), 0) as total_commission
    FROM tracking_links tl
    LEFT JOIN contracts c ON tl.contract_id = c.id
    LEFT JOIN clicks cl ON tl.id = cl.link_id
    LEFT JOIN conversions cv ON tl.id = cv.link_id
    WHERE tl.user_id = ?
    GROUP BY tl.id, tl.title, tl.original_url, tl.code, tl.created_at, c.brand_name, c.revenue_share
    ORDER BY tl.created_at DESC
  `, [userId]);
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const userId = (session.user as any).id;
  const { title, original_url, contract_id } = await req.json();
  if (!title || !original_url) {
    return NextResponse.json({ error: '제목과 URL을 입력해주세요.' }, { status: 400 });
  }
  const db = getDbClient();
  let code = generateCode();
  while (await db.queryOne('SELECT id FROM tracking_links WHERE code = ?', [code])) {
    code = generateCode();
  }
  const result = await db.run(`
    INSERT INTO tracking_links (user_id, contract_id, title, original_url, code)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, contract_id || null, title, original_url, code]);
  return NextResponse.json({ id: result.lastId, code });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const db = getDbClient();
  await db.run('DELETE FROM tracking_links WHERE id = ? AND user_id = ?', [id, userId]);
  return NextResponse.json({ success: true });
}
