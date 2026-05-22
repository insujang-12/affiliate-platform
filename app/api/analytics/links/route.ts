import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

interface LinkStat {
  id: number;
  title: string;
  code: string;
  brand_name: string;
  clicks: number;
  conversions: number;
  revenue: number;
  avg_order: number;
  conversion_rate: number;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const userId = (session.user as any).id;
  const period = new URL(req.url).searchParams.get('period') ?? '30d';

  const clicksCond =
    period === '7d'  ? "AND cl.clicked_at  >= datetime('now', '-7 days')" :
    period === '30d' ? "AND cl.clicked_at  >= datetime('now', '-30 days')" : '';

  const convsCond =
    period === '7d'  ? "AND cv.converted_at >= datetime('now', '-7 days')" :
    period === '30d' ? "AND cv.converted_at >= datetime('now', '-30 days')" : '';

  const heatCond =
    period === '7d'  ? "AND cl.clicked_at >= datetime('now', '-7 days')" :
    period === '30d' ? "AND cl.clicked_at >= datetime('now', '-30 days')" : '';

  const db = getDb();

  const links = db.prepare(`
    SELECT
      tl.id, tl.title, tl.code,
      COALESCE(c.brand_name, '계약 미연결') AS brand_name,
      COUNT(DISTINCT cl.id)  AS clicks,
      COUNT(DISTINCT cv.id)  AS conversions,
      COALESCE(SUM(cv.commission), 0) AS revenue,
      CASE WHEN COUNT(DISTINCT cv.id) > 0
        THEN CAST(COALESCE(SUM(cv.amount), 0) AS REAL) / COUNT(DISTINCT cv.id)
        ELSE 0 END AS avg_order,
      CASE WHEN COUNT(DISTINCT cl.id) > 0
        THEN CAST(COUNT(DISTINCT cv.id) AS REAL) / COUNT(DISTINCT cl.id) * 100
        ELSE 0 END AS conversion_rate
    FROM tracking_links tl
    LEFT JOIN contracts c ON tl.contract_id = c.id
    LEFT JOIN clicks cl ON tl.id = cl.link_id ${clicksCond}
    LEFT JOIN conversions cv ON tl.id = cv.link_id ${convsCond}
    WHERE tl.user_id = ?
    GROUP BY tl.id
    ORDER BY revenue DESC
  `).all(userId) as LinkStat[];

  const hourlyRaw = db.prepare(`
    SELECT
      CAST(strftime('%H', cl.clicked_at) AS INTEGER) AS hour,
      COUNT(*) AS clicks
    FROM clicks cl
    JOIN tracking_links tl ON cl.link_id = tl.id
    WHERE tl.user_id = ? ${heatCond}
    GROUP BY hour
    ORDER BY hour
  `).all(userId) as { hour: number; clicks: number }[];

  const hourlyMap: Record<number, number> = {};
  for (const row of hourlyRaw) hourlyMap[row.hour] = row.clicks;
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, clicks: hourlyMap[h] ?? 0 }));

  return NextResponse.json({ links, hourly });
}
