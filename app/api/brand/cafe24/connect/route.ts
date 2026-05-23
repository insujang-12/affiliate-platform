import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbClient } from '@/lib/db-client';
import { getAuthorizationUrl } from '@/lib/cafe24';

const REDIRECT_URI = 'https://affiliate-platform-pied-nine.vercel.app/api/brand/cafe24/callback';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.role !== 'brand') {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const credentialId = searchParams.get('credential_id');

  if (!credentialId) {
    return NextResponse.json({ error: 'credential_id 필요' }, { status: 400 });
  }

  const db = getDbClient();
  const cred = await db.queryOne<any>(
    'SELECT * FROM cafe24_credentials WHERE id = ? AND user_id = ?',
    [credentialId, user.id]
  );

  if (!cred) {
    return NextResponse.json({ error: '자격증명을 찾을 수 없습니다.' }, { status: 404 });
  }

  const state = Buffer.from(JSON.stringify({
    credential_id: credentialId,
    user_id: user.id,
  })).toString('base64url');

  const authUrl = getAuthorizationUrl(
    cred.mall_id,
    cred.client_id,
    REDIRECT_URI,
    state
  );

  return NextResponse.redirect(authUrl);
}
