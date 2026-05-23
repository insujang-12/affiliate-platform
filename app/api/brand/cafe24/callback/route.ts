import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db-client';
import { getAccessTokenByCode } from '@/lib/cafe24';

const REDIRECT_URI = 'https://affiliate-platform-pied-nine.vercel.app/api/brand/cafe24/callback';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const msg = searchParams.get('error_description') ?? error;
    return NextResponse.redirect(
      new URL(`/brand/dashboard/cafe24?error=${encodeURIComponent(msg)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/brand/dashboard/cafe24?error=잘못된 요청입니다.', req.url)
    );
  }

  let credentialId: string;
  let userId: string;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
    credentialId = parsed.credential_id;
    userId = parsed.user_id;
  } catch {
    return NextResponse.redirect(
      new URL('/brand/dashboard/cafe24?error=state 파싱 오류', req.url)
    );
  }

  const db = getDbClient();
  const cred = await db.queryOne<any>(
    'SELECT * FROM cafe24_credentials WHERE id = ? AND user_id = ?',
    [credentialId, userId]
  );

  if (!cred) {
    return NextResponse.redirect(
      new URL('/brand/dashboard/cafe24?error=자격증명을 찾을 수 없습니다.', req.url)
    );
  }

  try {
    const tokens = await getAccessTokenByCode(
      cred.mall_id,
      cred.client_id,
      cred.client_secret,
      code,
      REDIRECT_URI
    );

    await db.run(`
      UPDATE cafe24_credentials
      SET access_token = ?,
          refresh_token = ?,
          token_expires_at = ?,
          is_connected = 1
      WHERE id = ?
    `, [
      tokens.access_token,
      tokens.refresh_token ?? null,
      tokens.expires_at,
      credentialId,
    ]);

    return NextResponse.redirect(
      new URL('/brand/dashboard/cafe24?connected=1', req.url)
    );
  } catch (err: any) {
    const msg = err.message ?? '토큰 발급 실패';
    return NextResponse.redirect(
      new URL(`/brand/dashboard/cafe24?error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}
