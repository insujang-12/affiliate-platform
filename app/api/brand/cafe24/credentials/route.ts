import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbClient } from '@/lib/db-client';
import { getAccessToken } from '@/lib/cafe24';

function getBrandUser(session: any) {
  const user = session?.user;
  if (!user || user.role !== 'brand') return null;
  return user;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = getBrandUser(session);
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const db = getDbClient();
  const credentials = await db.query(`
    SELECT id, mall_id, client_id, is_connected, last_synced_at, created_at,
           CASE WHEN access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
           token_expires_at
    FROM cafe24_credentials WHERE user_id = ?
    ORDER BY created_at DESC
  `, [user.id]);

  return NextResponse.json(credentials);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = getBrandUser(session);
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { mall_id, client_id, client_secret } = await req.json();
  if (!mall_id || !client_id || !client_secret) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }

  const db = getDbClient();

  // Upsert
  const existing = await db.queryOne<any>(
    'SELECT id FROM cafe24_credentials WHERE user_id = ? AND mall_id = ?',
    [user.id, mall_id]
  );

  let credId: number;
  if (existing) {
    await db.run(`
      UPDATE cafe24_credentials
      SET client_id = ?, client_secret = ?, is_connected = 0,
          access_token = NULL, token_expires_at = NULL
      WHERE id = ?
    `, [client_id, client_secret, existing.id]);
    credId = existing.id;
  } else {
    const result = await db.run(`
      INSERT INTO cafe24_credentials (user_id, mall_id, client_id, client_secret)
      VALUES (?, ?, ?, ?)
    `, [user.id, mall_id, client_id, client_secret]);
    credId = result.lastId;
  }

  // Immediately test connection using client_credentials grant
  try {
    const tokens = await getAccessToken(mall_id, client_id, client_secret);

    await db.run(`
      UPDATE cafe24_credentials
      SET access_token = ?, token_expires_at = ?, is_connected = 1
      WHERE id = ?
    `, [tokens.access_token, tokens.expires_at, credId]);

    return NextResponse.json({ id: credId, connected: true });
  } catch (err: any) {
    return NextResponse.json({
      id: credId,
      connected: false,
      error: err.message ?? 'API 인증 실패',
    }, { status: 422 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = getBrandUser(session);
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const db = getDbClient();
  await db.run('DELETE FROM cafe24_credentials WHERE id = ? AND user_id = ?', [id, user.id]);

  return NextResponse.json({ success: true });
}
