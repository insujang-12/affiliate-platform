'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trophy, MousePointer, ShoppingBag, TrendingUp, DollarSign, ChevronUp, ChevronDown } from 'lucide-react';
import { formatKRW, formatNumber } from '@/lib/utils';

type Period = '7d' | '30d' | 'all';
type Metric = 'clicks' | 'conversion_rate' | 'revenue';
type SortField = 'clicks' | 'conversions' | 'conversion_rate' | 'revenue' | 'avg_order';
type SortDir = 'asc' | 'desc';

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

const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'all', label: '전체' },
];

const METRICS: { value: Metric; label: string; color: string }[] = [
  { value: 'clicks', label: '클릭수', color: '#10b981' },
  { value: 'conversion_rate', label: '전환율', color: '#f59e0b' },
  { value: 'revenue', label: '수익', color: '#6366f1' },
];

// Rank badge colors as static Tailwind class strings
const RANK_STYLES = [
  { card: 'border-2 border-amber-300 bg-amber-50', badge: 'bg-amber-400 text-white', title: 'text-amber-900' },
  { card: 'border-2 border-gray-300 bg-gray-50',   badge: 'bg-gray-400 text-white',  title: 'text-gray-700'  },
  { card: 'border-2 border-orange-300 bg-orange-50', badge: 'bg-orange-400 text-white', title: 'text-orange-900' },
];

// indigo-50 (#eef2ff) → indigo-600 (#4f46e5)
function heatColor(intensity: number): string {
  const r = Math.round(238 - 159 * intensity);
  const g = Math.round(242 - 172 * intensity);
  const b = Math.round(255 - 26  * intensity);
  return `rgb(${r},${g},${b})`;
}

function formatMetric(value: number, metric: Metric): string {
  if (metric === 'revenue') return formatKRW(value);
  if (metric === 'conversion_rate') return `${value}%`;
  return formatNumber(value);
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [links, setLinks] = useState<LinkStat[]>([]);
  const [hourly, setHourly] = useState<{ hour: number; clicks: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/links?period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        setLinks(Array.isArray(data.links) ? data.links : []);
        setHourly(Array.isArray(data.hourly) ? data.hourly : []);
        setLoading(false);
      });
  }, [period]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortField(field); setSortDir('desc'); }
  }

  const sortedLinks = useMemo(() =>
    [...links].sort((a, b) =>
      sortDir === 'desc' ? b[sortField] - a[sortField] : a[sortField] - b[sortField]
    ), [links, sortField, sortDir]);

  const top3 = useMemo(() => links.slice(0, 3), [links]);

  const totals = useMemo(() => ({
    clicks: links.reduce((s, l) => s + l.clicks, 0),
    conversions: links.reduce((s, l) => s + l.conversions, 0),
    revenue: links.reduce((s, l) => s + l.revenue, 0),
    avgConvRate: links.length > 0
      ? links.reduce((s, l) => s + l.conversion_rate, 0) / links.length
      : 0,
  }), [links]);

  const chartData = useMemo(() =>
    [...links]
      .sort((a, b) => (b[metric] as number) - (a[metric] as number))
      .map((l) => ({
        name: l.title.length > 13 ? l.title.slice(0, 13) + '…' : l.title,
        value: metric === 'conversion_rate'
          ? parseFloat(l.conversion_rate.toFixed(2))
          : metric === 'revenue' ? Math.round(l.revenue) : l.clicks,
      })),
  [links, metric]);

  const maxHeat = Math.max(...hourly.map((h) => h.clicks), 1);
  const metricColor = METRICS.find((m) => m.value === metric)?.color ?? '#6366f1';
  const metricLabel = METRICS.find((m) => m.value === metric)?.label ?? '';

  const BarTooltipContent = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        <p className="text-gray-500">
          {metricLabel}:{' '}
          <span className="font-semibold text-gray-900">
            {formatMetric(payload[0].value, metric)}
          </span>
        </p>
      </div>
    );
  }, [metric, metricLabel]);

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDir === 'desc'
          ? <ChevronDown size={12} className="text-indigo-500" />
          : <ChevronUp size={12} className="text-indigo-500" />
      ) : (
        <span className="text-gray-300 text-xs leading-none">⇅</span>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">성과 분석</h1>
          <p className="text-gray-500 mt-1 text-sm">링크별 성과와 클릭 패턴을 분석합니다.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : links.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-20 text-center">
          <TrendingUp size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400 text-sm">아직 데이터가 없습니다. 트래킹 링크를 만들어 공유해보세요.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '총 클릭수', value: formatNumber(totals.clicks), icon: MousePointer, bg: 'bg-emerald-100', fg: 'text-emerald-600' },
              { label: '총 전환수', value: `${formatNumber(totals.conversions)}건`, icon: ShoppingBag, bg: 'bg-indigo-100', fg: 'text-indigo-600' },
              { label: '총 수익', value: formatKRW(totals.revenue), icon: DollarSign, bg: 'bg-amber-100', fg: 'text-amber-600' },
              { label: '평균 전환율', value: `${totals.avgConvRate.toFixed(1)}%`, icon: TrendingUp, bg: 'bg-rose-100', fg: 'text-rose-600' },
            ].map(({ label, value, icon: Icon, bg, fg }) => (
              <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <div className={`p-2 rounded-lg ${bg}`}>
                    <Icon className={`w-4 h-4 ${fg}`} size={16} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* TOP 3 */}
          {top3.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Trophy size={17} className="text-amber-500" />
                TOP {top3.length} 링크
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((link, i) => (
                  <div key={link.id} className={`rounded-2xl p-5 ${RANK_STYLES[i].card}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${RANK_STYLES[i].badge}`}>
                        {i + 1}
                      </span>
                      <p className={`font-bold text-sm truncate flex-1 ${RANK_STYLES[i].title}`}>{link.title}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatKRW(link.revenue)}</p>
                    <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>클릭 {formatNumber(link.clicks)}</span>
                      <span>전환 {link.conversions}건</span>
                      <span>전환율 {link.conversion_rate.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="font-bold text-gray-900">링크별 성과 비교</h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMetric(m.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      metric === m.value
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 48)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    metric === 'revenue' ? `${(v / 1000).toFixed(0)}k` :
                    metric === 'conversion_rate' ? `${v}%` : String(v)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12, fill: '#374151' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<BarTooltipContent />} />
                <Bar dataKey="value" fill={metricColor} radius={[0, 6, 6, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Heatmap */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-1">시간대별 클릭 히트맵</h2>
            <p className="text-xs text-gray-400 mb-4">어느 시간대에 클릭이 집중되는지 확인하세요.</p>
            <div className="flex gap-1">
              {hourly.map((cell) => {
                const intensity = cell.clicks / maxHeat;
                const isHigh = intensity > 0.5;
                return (
                  <div
                    key={cell.hour}
                    className="flex-1 flex flex-col items-center gap-1.5"
                    title={`${cell.hour}시: ${cell.clicks}회`}
                  >
                    <div
                      className="w-full rounded-md cursor-default"
                      style={{ height: 36, backgroundColor: heatColor(intensity) }}
                    />
                    <span className="text-xs text-gray-400">{cell.hour}</span>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3">
              <span className="text-xs text-gray-400">낮음</span>
              <div className="flex gap-0.5">
                {[0.08, 0.25, 0.45, 0.65, 0.85].map((i) => (
                  <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: heatColor(i) }} />
                ))}
              </div>
              <span className="text-xs text-gray-400">높음</span>
            </div>
            {/* Peak hour callout */}
            {(() => {
              const peak = hourly.reduce((best, h) => h.clicks > best.clicks ? h : best, hourly[0]);
              if (peak.clicks === 0) return null;
              return (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  피크 시간대: {peak.hour}시 ({peak.clicks}회 클릭)
                </p>
              );
            })()}
          </div>

          {/* Detailed table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">링크별 상세 성과</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                    <th className="px-6 py-3 text-left font-semibold">링크명</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <SortBtn field="clicks">클릭수</SortBtn>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <SortBtn field="conversions">구매수</SortBtn>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <SortBtn field="conversion_rate">전환율</SortBtn>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <SortBtn field="revenue">총수익</SortBtn>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <SortBtn field="avg_order">평균주문금액</SortBtn>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedLinks.map((link) => (
                    <tr key={link.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-gray-900">{link.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{link.brand_name} · {link.code}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                        {formatNumber(link.clicks)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-700">
                        {link.conversions}건
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-semibold ${
                          link.conversion_rate >= 3 ? 'text-emerald-600' :
                          link.conversion_rate >= 1 ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {link.conversion_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-600">
                        {formatKRW(link.revenue)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-500">
                        {link.avg_order > 0 ? formatKRW(Math.round(link.avg_order)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
