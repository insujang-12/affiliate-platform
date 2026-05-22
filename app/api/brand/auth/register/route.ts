import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDbClient } from '@/lib/db-client';
import { BCRYPT_ROUNDS } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }

  const db = getDbClient();
  const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 이메일입니다.' }, { status: 409 });
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'brand')", [
    name,
    email,
    hash,
  ]);

  return NextResponse.json({ success: true });
}
