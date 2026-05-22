import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { generateCode } from '@/lib/utils';

const BUYER_NAMES = [
  '홍길동', '김민수', '이지은', '박서준', '최유리',
  '정하늘', '강지훈', '윤소연', '신동현', '오세영',
  '한소희', '임재현', '배수지', '조성진', '황민정',
];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundToNearest(n: number, unit = 100) {
  return Math.round(n / unit) * unit;
}

/** GET - 매칭 가능한 트래킹 링크 목록 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.role !== 'brand') {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const db = getDb();
  const links = db.prepare(`
    SELECT
      tl.id, tl.code, tl.title, tl.original_url,
      u.name  AS influencer_name,
      COALESCE(c.brand_name, '계약 미연결')  AS brand_name,
      COALESCE(c.revenue_share, 0)           AS revenue_share
    FROM tracking_links tl
    LEFT JOIN contracts c ON tl.contract_id = c.id
    LEFT JOIN users u ON tl.user_id = u.id
    ORDER BY tl.created_at DESC
  `).all();

  return NextResponse.json(links);
}

/** POST - 가짜 주문 1건 생성 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || user.role !== 'brand') {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const { link_code } = await req.json().catch(() => ({}));
  const db = getDb();

  // 브랜드 credential 조회 또는 테스트용 자동 생성
  let cred = db.prepare(
    'SELECT id FROM cafe24_credentials WHERE user_id = ? LIMIT 1'
  ).get(user.id) as any;

  if (!cred) {
    const result = db.prepare(`
      INSERT INTO cafe24_credentials (user_id, mall_id, client_id, client_secret, is_connected)
      VALUES (?, 'testmall', 'test_client_id', 'test_secret', 1)
    `).run(user.id);
    cred = { id: Number(result.lastInsertRowid) };
  }

  // 트래킹 링크 선택 (지정 or 랜덤)
  const link = (
    link_code
      ? db.prepare(`
          SELECT tl.id, tl.code, tl.title, u.name AS influencer_name,
                 COALESCE(c.revenue_share, 0) AS revenue_share
          FROM tracking_links tl
          LEFT JOIN contracts c ON tl.contract_id = c.id
          LEFT JOIN users u ON tl.user_id = u.id
          WHERE tl.code = ?
        `).get(link_code)
      : db.prepare(`
          SELECT tl.id, tl.code, tl.title, u.name AS influencer_name,
                 COALESCE(c.revenue_share, 0) AS revenue_share
          FROM tracking_links tl
          LEFT JOIN contracts c ON tl.contract_id = c.id
          LEFT JOIN users u ON tl.user_id = u.id
          ORDER BY RANDOM() LIMIT 1
        `).get()
  ) as any;

  if (!link) {
    return NextResponse.json(
      { error: '사용 가능한 트래킹 링크가 없습니다.' },
      { status: 400 }
    );
  }

  // 랜덤 주문 생성
  const orderId = `TEST-${Date.now()}-${generateCode(4)}`;
  const amount = roundToNearest(randomBetween(9_900, 498_000), 100);
  const commission = Math.round(amount * link.revenue_share / 100);
  const buyerName = BUYER_NAMES[Math.floor(Math.random() * BUYER_NAMES.length)];
  // SQLite-safe datetime format (no milliseconds, no Z suffix)
  const orderDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    db.prepare(`
      INSERT OR IGNORE INTO cafe24_synced_orders
        (credential_id, order_id, order_date, buyer_name, total_price,
         affiliate_code, link_id, commission, is_attributed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(cred.id, orderId, orderDate, buyerName, amount, link.code, link.id, commission);

    // conversions 테이블에도 삽입 → 인플루언서 대시보드 즉시 반영
    const already = db.prepare(
      'SELECT id FROM conversions WHERE order_id = ? AND link_id = ?'
    ).get(orderId, link.id);

    if (!already) {
      db.prepare(`
        INSERT INTO conversions (link_id, order_id, amount, commission, converted_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(link.id, orderId, amount, commission, orderDate);
    }
  } catch (err: any) {
    console.error('[test-order] DB error:', err);
    return NextResponse.json({ error: `DB 오류: ${err.message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    order: {
      order_id: orderId,
      buyer_name: buyerName,
      amount,
      commission,
      revenue_share: link.revenue_share,
      link_code: link.code,
      link_title: link.title,
      influencer_name: link.influencer_name,
      order_date: orderDate,
    },
  });
}
