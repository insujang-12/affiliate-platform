'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle,
  Wifi, WifiOff, Clock, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatKRW, formatNumber } from '@/lib/utils';

interface Credential {
  id: number;
  mall_id: string;
  client_id: string;
  is_connected: number;
  last_synced_at: string | null;
  token_expires_at: string | null;
}

interface SyncLogEntry {
  time: Date;
  fetched: number;
  synced: number;
  attributed: number;
  error?: string;
}

interface Order {
  id: number;
  order_id: string;
  order_date: string;
  buyer_name: string;
  total_price: number;
  affiliate_code: string | null;
  link_title: string | null;
  link_code: string | null;
  commission: number;
  is_attributed: number;
  synced_at: string;
}

interface Stats {
  total_orders: number;
  attributed_orders: number;
  total_sales: number;
  total_commission: number;
}

const SYNC_INTERVAL = 300;

function fmtCountdown(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export default function Cafe24Page() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [countdown, setCountdown] = useState(SYNC_INTERVAL);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [mallId, setMallId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const syncingRef = useRef(false);
  const autoSyncRef = useRef(true);
  const activeCred = credentials.find((c) => c.is_connected);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // URL 파라미터로 연결 성공/실패 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      showToast('success', '카페24 연결 성공! 동기화를 시작합니다.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      showToast('error', decodeURIComponent(params.get('error')!));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchCredentials = useCallback(async () => {
    const res = await fetch('/api/brand/cafe24/credentials');
    const data = await res.json();
    if (Array.isArray(data)) setCredentials(data);
  }, []);

  const fetchOrders = useCallback(async (credId?: number) => {
    const res = await fetch(
      `/api/brand/cafe24/orders?limit=100${credId ? `&credential_id=${credId}` : ''}`
    );
    const data = await res.json();
    if (data.stats) setStats(data.stats);
    if (Array.isArray(data.orders)) setOrders(data.orders);
  }, []);

  useEffect(() => {
    async function init() {
      await Promise.all([fetchCredentials(), fetchOrders()]);
      setLoading(false);
    }
    init();
  }, [fetchCredentials, fetchOrders]);

  const doSync = useCallback(
    async (credId: number) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      setSyncing(true);

      try {
        const res = await fetch('/api/brand/cafe24/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential_id: credId }),
        });
        const data = await res.json();

        setSyncLog((prev) =>
          [
            {
              time: new Date(),
              fetched: data.total_fetched ?? 0,
              synced: data.synced ?? 0,
              attributed: data.attributed ?? 0,
              error: res.ok ? undefined : (data.error ?? '오류'),
            },
            ...prev,
          ].slice(0, 10)
        );

        if (res.ok) {
          await Promise.all([fetchCredentials(), fetchOrders(credId)]);
        } else if (res.status === 401) {
          setCredentials((prev) =>
            prev.map((c) => (c.id === credId ? { ...c, is_connected: 0 } : c))
          );
          showToast('error', data.error ?? '인증 오류');
        }
      } catch {
        setSyncLog((prev) =>
          [{ time: new Date(), fetched: 0, synced: 0, attributed: 0, error: '네트워크 오류' }, ...prev].slice(0, 10)
        );
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [fetchCredentials, fetchOrders]
  );

  useEffect(() => {
    if (!activeCred) return;
    const credId = activeCred.id;
    setCountdown(SYNC_INTERVAL);

    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (autoSyncRef.current && !syncingRef.current) {
            doSync(credId);
          }
          return SYNC_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [activeCred?.id, doSync]);

  function toggleAutoSync() {
    const next = !autoSync;
    setAutoSync(next);
    autoSyncRef.current = next;
    if (next) setCountdown(SYNC_INTERVAL);
  }

  async function handleSaveCredential(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/brand/cafe24/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mall_id: mallId, client_id: clientId, client_secret: clientSecret }),
    });
    const data = await res.json();
    setCreating(false);

    if (data.connect_url) {
      // 저장 완료 → 카페24 로그인 페이지로 이동
      setShowAddForm(false);
      window.location.href = data.connect_url;
    } else {
      showToast('error', data.error ?? 'API 인증에 실패했습니다. 정보를 확인해주세요.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 연동 정보를 삭제하시겠습니까?')) return;
    await fetch(`/api/brand/cafe24/credentials?id=${id}`, { method: 'DELETE' });
    setCredentials((prev) => prev.filter((c) => c.id !== id));
    showToast('success', '삭제되었습니다.');
  }

  const attributionRate =
    stats && stats.total_orders > 0
      ? ((stats.attributed_orders / stats.total_orders) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 max-w-sm transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">카페24 연동</h1>
          <p className="text-gray-500 mt-1 text-sm">
            카페24 앱의 Client ID와 Secret을 입력하면 카페24 로그인 후 자동으로 연동됩니다.
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} size="md">
          <Plus size={16} className="mr-1.5" />
          쇼핑몰 추가
        </Button>
      </div>

      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
        <p className="text-sm font-semibold text-violet-900 mb-3">카페24 연동 방법</p>
        <ol className="space-y-2 text-sm text-violet-700">
          <li className="flex gap-2 items-start">
            <span className="w-5 h-5 bg-violet-200 text-violet-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
            <span><strong className="text-violet-900">카페24 개발자센터</strong>(developers.cafe24.com)에서 앱을 생성하고 Client ID / Secret을 발급받으세요.</span>
          </li>
          <li className="flex gap-2 items-start">
            <span className="w-5 h-5 bg-violet-200 text-violet-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
            <span>앱 설정의 <strong className="text-violet-900">Redirect URI</strong>에 <code className="bg-violet-100 px-1 rounded text-xs">https://affiliate-platform-pied-nine.vercel.app/api/brand/cafe24/callback</code> 를 등록하세요.</span>
          </li>
          <li className="flex gap-2 items-start">
            <span className="w-5 h-5 bg-violet-200 text-violet-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
            <span>아래 <strong className="text-violet-900">쇼핑몰 추가</strong> 버튼을 눌러 쇼핑몰 ID, Client ID, Secret을 입력하세요.</span>
          </li>
          <li className="flex gap-2 items-start">
            <span className="w-5 h-5 bg-violet-200 text-violet-800 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">4</span>
            <span>카페24 로그인 화면이 뜨면 로그인하면 자동으로 연동 완료됩니다.</span>
          </li>
        </ol>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">카페24 쇼핑몰 연동</h2>
            <p className="text-sm text-gray-500 mb-5">
              저장 후 카페24 로그인 페이지로 이동합니다.
            </p>
            <form onSubmit={handleSaveCredential} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">쇼핑몰 ID</label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent">
                  <input
                    value={mallId}
                    onChange={(e) => setMallId(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="flex-1 px-4 py-2.5 text-sm outline-none"
                    placeholder="myshop"
                    required
                  />
                  <span className="px-3 py-2.5 bg-gray-50 border-l border-gray-300 text-sm text-gray-400">
                    .cafe24.com
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">클라이언트 ID</label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="cafe24 앱의 Client ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">클라이언트 시크릿</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="cafe24 앱의 Client Secret"
                  required
                />
              </div>
              {creating && (
                <div className="flex items-center gap-2 text-sm text-violet-600 bg-violet-50 rounded-lg px-4 py-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-600" />
                  저장 중...
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" className="flex-1"
                  onClick={() => setShowAddForm(false)}>
                  취소
                </Button>
                <Button type="submit" loading={creating} className="flex-1 bg-violet-600 hover:bg-violet-700">
                  저장 후 카페24 로그인
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : credentials.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-100">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">연동된 쇼핑몰이 없습니다.</p>
          <button onClick={() => setShowAddForm(true)}
            className="mt-3 text-sm text-violet-600 font-medium hover:underline">
            첫 번째 쇼핑몰 연동하기 →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {credentials.map((cred) => (
            <div key={cred.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  cred.is_connected ? 'bg-violet-100' : 'bg-gray-100'
                }`}>
                  {cred.is_connected
                    ? <Wifi size={18} className="text-violet-600" />
                    : <WifiOff size={18} className="text-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{cred.mall_id}.cafe24.com</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      cred.is_connected
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {cred.is_connected ? '연결됨' : '연결 필요'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    클라이언트 ID: <span className="font-mono">{cred.client_id.slice(0, 12)}...</span>
                    {cred.last_synced_at && (
                      <> · 마지막 동기화: {new Date(cred.last_synced_at).toLocaleString('ko-KR')}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cred.is_connected && activeCred?.id === cred.id && (
                    <Button size="sm" variant="secondary" loading={syncing}
                      onClick={() => { doSync(cred.id); setCountdown(SYNC_INTERVAL); }}>
                      <RefreshCw size={14} className={syncing ? 'animate-spin mr-1' : 'mr-1'} />
                      지금 동기화
                    </Button>
                  )}
                  {!cred.is_connected && (
                    <button
                      onClick={() => {
                        window.location.href = `/api/brand/cafe24/connect?credential_id=${cred.id}`;
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                    >
                      카페24 로그인
                    </button>
                  )}
                  <button onClick={() => handleDelete(cred.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {cred.is_connected && activeCred?.id === cred.id && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-600">
                      {autoSync
                        ? <><span className="font-mono font-semibold text-violet-600">{fmtCountdown(countdown)}</span> 후 자동 동기화</>
                        : <span className="text-gray-400">자동 동기화 꺼짐</span>
                      }
                    </span>
                  </div>
                  <button onClick={toggleAutoSync}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      autoSync ? 'text-violet-600 hover:text-violet-800' : 'text-gray-400 hover:text-gray-600'
                    }`}>
                    {autoSync
                      ? <><ToggleRight size={18} /> 자동 동기화 ON</>
                      : <><ToggleLeft size={18} /> 자동 동기화 OFF</>
                    }
                  </button>
                  {syncing && (
                    <div className="flex items-center gap-1.5 text-xs text-violet-600 ml-auto">
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-violet-600" />
                      동기화 중...
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {syncLog.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-sm">동기화 로그</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {syncLog.map((entry, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4 text-sm">
                <div className={`w-2 h-2 rounded-full shrink-0 ${entry.error ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="text-gray-400 text-xs font-mono shrink-0">
                  {entry.time.toLocaleTimeString('ko-KR')}
                </span>
                {entry.error ? (
                  <span className="text-red-600 text-xs">{entry.error}</span>
                ) : (
                  <span className="text-gray-600 text-xs">
                    <span className="font-semibold text-gray-800">{entry.fetched}건</span> 조회 ·{' '}
                    <span className="font-semibold text-gray-800">{entry.synced}건</span> 신규 ·{' '}
                    <span className="font-semibold text-violet-600">{entry.attributed}건</span> 귀속
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">동기화된 주문</h2>
              <span className="text-xs text-gray-400">{orders.length}건</span>
            </div>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '전체 주문', value: formatNumber(stats.total_orders) + '건', hl: false },
                  { label: '귀속 주문', value: formatNumber(stats.attributed_orders) + '건', hl: true },
                  { label: '귀속률', value: attributionRate + '%', hl: false },
                  { label: '총 커미션', value: formatKRW(stats.total_commission), hl: true },
                ].map(({ label, value, hl }) => (
                  <div key={label} className={`rounded-xl p-3 ${hl ? 'bg-violet-50' : 'bg-gray-50'}`}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${hl ? 'text-violet-700' : 'text-gray-900'}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  {['주문번호', '주문일', '구매자', '금액', '귀속 링크', '커미션', '상태'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-700">{order.order_id}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{order.buyer_name ?? '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{formatKRW(order.total_price)}</td>
                    <td className="px-4 py-3">
                      {order.link_title ? (
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{order.link_title}</span>
                      ) : order.affiliate_code ? (
                        <span className="text-xs font-mono text-gray-400">{order.affiliate_code}</span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-violet-600 whitespace-nowrap">
                      {order.is_attributed ? formatKRW(order.commission) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                        order.is_attributed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {order.is_attributed ? '귀속됨' : '미귀속'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
