import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const userId = (session.user as any).id;
  const db = getDb();

  const links = db.prepare(`
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
    GROUP BY tl.id
    ORDER BY tl.created_at DESC
  `).all(userId);

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

  const db = getDb();
  let code = generateCode();
  // Ensure uniqueness
  while (db.prepare('SELECT id FROM tracking_links WHERE code = ?').get(code)) {
    code = generateCode();
  }

  const result = db.prepare(`
    INSERT INTO tracking_links (user_id, contract_id, title, original_url, code)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, contract_id || null, title, original_url, code);

  return NextResponse.json({ id: result.lastInsertRowid, code });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const db = getDb();
  db.prepare('DELETE FROM tracking_links WHERE id = ? AND user_id = ?').run(id, userId);

  return NextResponse.json({ success: true });
}
