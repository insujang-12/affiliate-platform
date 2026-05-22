'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Store, ShoppingCart, TrendingUp, DollarSign,
  CheckCircle, AlertCircle, FlaskConical, ChevronDown, Loader2, ExternalLink,
} from 'lucide-react';
import { formatKRW, formatNumber } from '@/lib/utils';

interface Credential {
  id: number;
  mall_id: string;
  client_id: string;
  is_connected: number;
  last_synced_at: string | null;
  has_token: number;
}

interface Stats {
  total_orders: number;
  attributed_orders: number;
  total_sales: number;
  total_commission: number;
}

interface RecentOrder {
  id: number;
  order_id: string;
  order_date: string;
  buyer_name: string;
  total_price: number;
  affiliate_code: string | null;
  link_title: string | null;
  commission: number;
  is_attributed: number;
  synced_at: string;
}

interface TrackingLink {
  id: number;
  code: string;
  title: string;
  influencer_name: string | null;
  brand_name: string;
  revenue_share: number;
}

interface TestOrderResult {
  order_id: string;
  buyer_name: string;
  amount: number;
  commission: number;
  revenue_share: number;
  link_code: string;
  link_title: string;
  influencer_name: string | null;
  order_date: string;
}

const COUNT_OPTIONS = [1, 3, 5, 10];

export default function BrandDashboardPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Test order state
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [selectedLink, setSelectedLink] = useState<string>('');
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<TestOrderResult[]>([]);
  const [testError, setTestError] = useState('');

  const loadStats = useCallback(async () => {
    const [credRes, orderRes] = await Promise.all([
      fetch('/api/brand/cafe24/credentials'),
      fetch('/api/brand/cafe24/orders?limit=5'),
    ]);
    const credData = await credRes.json();
    const orderData = await orderRes.json();
    if (Array.isArray(credData)) setCredentials(credData);
    if (orderData.stats) setStats(orderData.stats);
    if (Array.isArray(orderData.orders)) setRecentOrders(orderData.orders.slice(0, 5));
  }, []);

  useEffect(() => {
    async function load() {
      await loadStats();
      const linkRes = await fetch('/api/brand/cafe24/test-order');
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        if (Array.isArray(linkData)) setLinks(linkData);
      }
      setLoading(false);
    }
    load();
  }, [loadStats]);

  const connectedCount = credentials.filter((c) => c.is_connected).length;
  const attributionRate =
    stats && stats.total_orders > 0
      ? ((stats.attributed_orders / stats.total_orders) * 100).toFixed(1)
      : '0.0';

  async function handleGenerate() {
    setGenerating(true);
    setTestError('');
    setResults([]);
    const newResults: TestOrderResult[] = [];
    for (let i = 0; i < count; i++) {
      const res = await fetch('/api/brand/cafe24/test-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link_code: selectedLink || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestError(data.error ?? '주문 생성 실패');
        break;
      }
      newResults.push(data.order);
    }
    setResults(newResults);
    setGenerating(false);
    // Refresh stats so the new orders appear in the dashboard counts
    await loadStats();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">브랜드 대시보드</h1>
        <p className="text-gray-500 mt-1 text-sm">카페24 연동 현황과 어필리에이트 성과를 확인하세요.</p>
      </div>

      {/* Connection status */}
      {!loading && credentials.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">카페24 연동이 필요합니다</p>
            <p className="text-sm text-amber-700 mt-0.5">
              카페24 관리자에서 발급한 클라이언트 ID/시크릿을 입력하면 주문 데이터가 5분마다 자동 동기화됩니다.
            </p>
          </div>
          <Link
            href="/brand/dashboard/cafe24"
            className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700"
          >
            API 설정
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: '연동된 쇼핑몰',
            value: `${connectedCount}개`,
            sub: `전체 ${credentials.length}개`,
            icon: Store,
            bg: 'bg-violet-100',
            fg: 'text-violet-600',
          },
          {
            label: '총 동기화 주문',
            value: formatNumber(stats?.total_orders ?? 0),
            sub: `어필리에이트 ${formatNumber(stats?.attributed_orders ?? 0)}건`,
            icon: ShoppingCart,
            bg: 'bg-indigo-100',
            fg: 'text-indigo-600',
          },
          {
            label: '어필리에이트 매출',
            value: formatKRW(stats?.total_sales ?? 0),
            sub: `귀속률 ${attributionRate}%`,
            icon: TrendingUp,
            bg: 'bg-emerald-100',
            fg: 'text-emerald-600',
          },
          {
            label: '지급 커미션',
            value: formatKRW(stats?.total_commission ?? 0),
            sub: '인플루언서 수익 합계',
            icon: DollarSign,
            bg: 'bg-amber-100',
            fg: 'text-amber-600',
          },
        ].map(({ label, value, sub, icon: Icon, bg, fg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${fg}`} size={16} />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Test Order Generator ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-2">
          <FlaskConical size={16} className="text-amber-600" />
          <h2 className="font-bold text-amber-900">테스트 주문 생성</h2>
          <span className="ml-auto text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
            TEST MODE
          </span>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-amber-800">
            가짜 주문을 생성해 전체 어필리에이트 흐름(트래킹 링크 매칭 → 수익쉐어 계산 → 인플루언서 반영)을 테스트합니다.
          </p>

          <div className="flex flex-wrap gap-3">
            {/* Link selector */}
            <div className="relative flex-1 min-w-48">
              <select
                value={selectedLink}
                onChange={(e) => setSelectedLink(e.target.value)}
                className="w-full appearance-none bg-white border border-amber-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">랜덤 트래킹 링크</option>
                {links.map((l) => (
                  <option key={l.id} value={l.code}>
                    [{l.code}] {l.title} — {l.influencer_name ?? '인플루언서 미지정'} ({l.revenue_share}%)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
            </div>

            {/* Count selector */}
            <div className="flex items-center gap-1 bg-white border border-amber-300 rounded-lg px-1 py-1">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    count === n
                      ? 'bg-amber-500 text-white'
                      : 'text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {n}건
                </button>
              ))}
            </div>

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              disabled={generating || links.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {generating ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <FlaskConical size={15} />
              )}
              {generating ? '생성 중…' : '주문 생성'}
            </button>
          </div>

          {links.length === 0 && !loading && (
            <p className="text-xs text-amber-700">
              트래킹 링크가 없습니다.{' '}
              <Link href="/dashboard/links" className="underline font-medium">
                인플루언서 대시보드에서 링크를 먼저 생성하세요.
              </Link>
            </p>
          )}

          {testError && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle size={15} className="shrink-0" />
              {testError}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                  생성된 주문 {results.length}건
                </p>
                <Link
                  href="/dashboard"
                  target="_blank"
                  className="flex items-center gap-1 text-xs text-violet-600 hover:underline font-medium"
                >
                  인플루언서 대시보드에서 확인
                  <ExternalLink size={11} />
                </Link>
              </div>
              <div className="rounded-xl border border-amber-200 overflow-hidden divide-y divide-amber-100">
                {results.map((r) => (
                  <div key={r.order_id} className="bg-white px-4 py-3 flex items-center gap-4">
                    <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.order_id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {r.buyer_name} · {r.link_title} · {r.influencer_name ?? '인플루언서 미지정'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatKRW(r.amount)}</p>
                      <p className="text-xs text-violet-600 mt-0.5">
                        수수료 {formatKRW(r.commission)} ({r.revenue_share}%)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connected stores */}
      {credentials.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">연동된 쇼핑몰</h2>
            <Link href="/brand/dashboard/cafe24" className="text-sm text-violet-600 hover:underline">
              관리 →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {credentials.map((cred) => (
              <div key={cred.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                  <Store size={16} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {cred.mall_id}.cafe24.com
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cred.last_synced_at
                      ? `마지막 동기화: ${new Date(cred.last_synced_at).toLocaleString('ko-KR')}`
                      : '아직 동기화되지 않음'}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    cred.is_connected
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {cred.is_connected ? '연결됨' : '미연결'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">최근 동기화 주문</h2>
            <Link href="/brand/dashboard/cafe24" className="text-sm text-violet-600 hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order) => (
              <div key={order.id} className="px-6 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{order.order_id}</span>
                    {order.is_attributed ? (
                      <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                    ) : (
                      <span className="text-xs text-gray-400">미귀속</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {order.buyer_name} · {order.link_title ?? order.affiliate_code ?? '코드 없음'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">{formatKRW(order.total_price)}</p>
                  {order.is_attributed && (
                    <p className="text-xs text-violet-600 mt-0.5">수수료 {formatKRW(order.commission)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
