'use client';
import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { formatKRW, formatNumber } from '@/lib/utils';
import { DollarSign, MousePointer, TrendingUp, Link2 } from 'lucide-react';

interface Analytics {
  summary: {
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    total_links: number;
  };
  thisMonth: {
    clicks: number;
    revenue: number;
  };
}

interface Link {
  id: number;
  title: string;
  brand_name: string | null;
  click_count: number;
  conversion_count: number;
  total_commission: number;
  code: string;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [links, setLinks] = useState<Link[]>([]);

  useEffect(() => {
    fetch('/api/analytics').then((r) => r.json()).then(setAnalytics);
    fetch('/api/links').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setLinks(data.slice(0, 5));
    });
  }, []);

  const conversionRate =
    analytics && analytics.summary.total_clicks > 0
      ? ((analytics.summary.total_conversions / analytics.summary.total_clicks) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1 text-sm">어필리에이트 성과를 한눈에 확인하세요.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="총 수익"
          value={analytics ? formatKRW(analytics.summary.total_revenue) : '—'}
          subValue={analytics ? `이번 달 ${formatKRW(analytics.thisMonth.revenue)}` : undefined}
          icon={DollarSign}
          color="indigo"
        />
        <StatsCard
          title="총 클릭수"
          value={analytics ? formatNumber(analytics.summary.total_clicks) : '—'}
          subValue={analytics ? `이번 달 ${formatNumber(analytics.thisMonth.clicks)}회` : undefined}
          icon={MousePointer}
          color="emerald"
        />
        <StatsCard
          title="전환율"
          value={`${conversionRate}%`}
          subValue={
            analytics
              ? `전환 ${formatNumber(analytics.summary.total_conversions)}건`
              : undefined
          }
          icon={TrendingUp}
          color="amber"
        />
        <StatsCard
          title="활성 링크"
          value={analytics ? formatNumber(analytics.summary.total_links) : '—'}
          icon={Link2}
          color="rose"
        />
      </div>

      {/* Revenue Chart */}
      <RevenueChart />

      {/* Recent Links */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">최근 링크</h2>
          <a href="/dashboard/links" className="text-sm text-indigo-600 hover:underline font-medium">
            전체 보기
          </a>
        </div>
        {links.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">링크가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {links.map((link) => (
              <div key={link.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{link.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{link.brand_name ?? '계약 미연결'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatKRW(link.total_commission)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    클릭 {formatNumber(link.click_count)} · 전환 {link.conversion_count}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
