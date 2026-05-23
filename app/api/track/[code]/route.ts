import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db-client';
import { addAffiliateCodeToUrl } from '@/lib/cafe24';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = getDbClient();

  const link = await db.queryOne<any>(`
    SELECT tl.*, c.end_date
    FROM tracking_links tl
    LEFT JOIN contracts c ON tl.contract_id = c.id
    WHERE tl.code = ?
  `, [code]);

  if (!link) {
    return NextResponse.json({ error: '링크를 찾을 수 없습니다.' }, { status: 404 });
  }

  if (link.end_date) {
    const today = new Date().toISOString().split('T')[0];
    if (link.end_date < today) {
      return NextResponse.redirect(new URL('/expired', req.url));
    }
  }

  await db.run('INSERT INTO clicks (link_id, ip, user_agent) VALUES (?, ?, ?)', [
    link.id,
    req.headers.get('x-forwarded-for') || 'unknown',
    req.headers.get('user-agent') || 'unknown',
  ]);

  const redirectUrl = addAffiliateCodeToUrl(link.original_url, link.code);
  return NextResponse.redirect(redirectUrl);
}
