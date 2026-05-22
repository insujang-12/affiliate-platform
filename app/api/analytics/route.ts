import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDbClient } from '@/lib/db-client';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  const userId = (session.user as any).id;
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'daily';

  const db = getDbClient();

  let groupFormat: string;
  let days: number;

  if (period === 'monthly') {
    groupFormat = '%Y-%m';
    days = 365;
  } else if (period === 'weekly') {
    groupFormat = '%Y-W%W';
    days = 90;
  } else {
    groupFormat = '%Y-%m-%d';
    days = 30;
  }

  let chartData: any[];

  if (db.isPg) {
    const pgGroupFormat =
      period === 'monthly' ? 'YYYY-MM' :
      period === 'weekly'  ? 'IYYY-"W"IW' :
      'YYYY-MM-DD';

    chartData = await db.query(`
      SELECT
        TO_CHAR(d.date, '${pgGroupFormat}') as label,
        COALESCE(SUM(cl.cnt), 0) as clicks,
        COALESCE(SUM(cv.cnt), 0) as conversions,
        COALESCE(SUM(cv.revenue), 0) as revenue
      FROM (
        SELECT generate_series(
          (NOW() - INTERVAL '${days - 1} days')::DATE,
          NOW()::DATE,
          '1 day'::INTERVAL
        )::DATE as date
      ) d
      LEFT JOIN (
        SELECT cl.clicked_at::DATE as date, COUNT(*) as cnt
        FROM clicks cl
        JOIN tracking_links tl ON cl.link_id = tl.id
        WHERE tl.user_id = ?
        GROUP BY cl.clicked_at::DATE
      ) cl ON d.date = cl.date
      LEFT JOIN (
        SELECT cv.converted_at::DATE as date, COUNT(*) as cnt, SUM(cv.commission) as revenue
        FROM conversions cv
        JOIN tracking_links tl ON cv.link_id = tl.id
        WHERE tl.user_id = ?
        GROUP BY cv.converted_at::DATE
      ) cv ON d.date = cv.date
      GROUP BY label
      ORDER BY label ASC
    `, [userId, userId]);
  } else {
    chartData = await db.query(`
      SELECT
        strftime('${groupFormat}', d.date) as label,
        COALESCE(SUM(cl.cnt), 0) as clicks,
        COALESCE(SUM(cv.cnt), 0) as conversions,
        COALESCE(SUM(cv.revenue), 0) as revenue
      FROM (
        SELECT date(datetime('now'), '-' || seq || ' days') as date
        FROM (WITH RECURSIVE seq(seq) AS (SELECT 0 UNION ALL SELECT seq+1 FROM seq WHERE seq < ${days - 1}) SELECT seq FROM seq)
      ) d
      LEFT JOIN (
        SELECT date(cl.clicked_at) as date, COUNT(*) as cnt
        FROM clicks cl
        JOIN tracking_links tl ON cl.link_id = tl.id
        WHERE tl.user_id = ?
        GROUP BY date(cl.clicked_at)
      ) cl ON d.date = cl.date
      LEFT JOIN (
        SELECT date(cv.converted_at) as date, COUNT(*) as cnt, SUM(cv.commission) as revenue
        FROM conversions cv
        JOIN tracking_links tl ON cv.link_id = tl.id
        WHERE tl.user_id = ?
        GROUP BY date(cv.converted_at)
      ) cv ON d.date = cv.date
      GROUP BY label
      ORDER BY label ASC
    `, [userId, userId]);
  }

  // Summary stats
  const summary = await db.queryOne(`
    SELECT
      COUNT(DISTINCT cl.id) as total_clicks,
      COUNT(DISTINCT cv.id) as total_conversions,
      COALESCE(SUM(cv.commission), 0) as total_revenue,
      COUNT(DISTINCT tl.id) as total_links
    FROM tracking_links tl
    LEFT JOIN clicks cl ON tl.id = cl.link_id
    LEFT JOIN conversions cv ON tl.id = cv.link_id
    WHERE tl.user_id = ?
  `, [userId]) as any;

  // This month stats
  let thisMonth: any;
  if (db.isPg) {
    thisMonth = await db.queryOne(`
      SELECT
        COUNT(DISTINCT cl.id) as clicks,
        COALESCE(SUM(cv.commission), 0) as revenue
      FROM tracking_links tl
      LEFT JOIN clicks cl ON tl.id = cl.link_id AND TO_CHAR(cl.clicked_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
      LEFT JOIN conversions cv ON tl.id = cv.link_id AND TO_CHAR(cv.converted_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
      WHERE tl.user_id = ?
    `, [userId]) as any;
  } else {
    thisMonth = await db.queryOne(`
      SELECT
        COUNT(DISTINCT cl.id) as clicks,
        COALESCE(SUM(cv.commission), 0) as revenue
      FROM tracking_links tl
      LEFT JOIN clicks cl ON tl.id = cl.link_id AND strftime('%Y-%m', cl.clicked_at) = strftime('%Y-%m', 'now')
      LEFT JOIN conversions cv ON tl.id = cv.link_id AND strftime('%Y-%m', cv.converted_at) = strftime('%Y-%m', 'now')
      WHERE tl.user_id = ?
    `, [userId]) as any;
  }

  return NextResponse.json({ chartData, summary, thisMonth });
}
