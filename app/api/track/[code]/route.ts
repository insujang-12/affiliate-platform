import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { addAffiliateCodeToUrl } from '@/lib/cafe24';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const db = getDb();
  const link = db.prepare('SELECT * FROM tracking_links WHERE code = ?').get(code) as any;

  if (!link) {
    return NextResponse.json({ error: '링크를 찾을 수 없습니다.' }, { status: 404 });
  }

  db.prepare('INSERT INTO clicks (link_id, ip, user_agent) VALUES (?, ?, ?)').run(
    link.id,
    req.headers.get('x-forwarded-for') || 'unknown',
    req.headers.get('user-agent') || 'unknown'
  );

  // Append affiliate tracking params so Cafe24 can capture them
  const redirectUrl = addAffiliateCodeToUrl(link.original_url, link.code);
  return NextResponse.redirect(redirectUrl);
}
