'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Trash2, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatKRW, formatNumber } from '@/lib/utils';

interface TrackingLink {
  id: number;
  title: string;
  original_url: string;
  code: string;
  brand_name: string | null;
  revenue_share: number | null;
  click_count: number;
  conversion_count: number;
  total_commission: number;
  created_at: string;
  end_date: string | null;
}

interface Contract {
  id: number;
  brand_name: string;
  revenue_share: number;
  end_date: string;
}

function isExpired(endDate: string | null): boolean {
  if (!endDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return endDate < today;
}

export default function LinksPage() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [contractId, setContractId] = useState('');

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    const [linksRes, contractsRes] = await Promise.all([
      fetch('/api/links'),
      fetch('/api/contracts'),
    ]);
    const linksData = await linksRes.json();
    const contractsData = await contractsRes.json();
    if (Array.isArray(linksData)) {
      setLinks(linksData.map((l: any) => ({ ...l, id: Number(l.id) })));
    }
    if (Array.isArray(contractsData)) {
      setContracts(contractsData.map((c: any) => ({
        ...c,
        id: Number(c.id),
        revenue_share: Number(c.revenue_share),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        original_url: url,
        contract_id: contractId ? Number(contractId) : undefined,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setTitle('');
      setUrl('');
      setContractId('');
      setShowForm(false);
      fetchLinks();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('이 링크를 삭제하시겠습니까?')) return;
    await fetch(`/api/links?id=${id}`, { method: 'DELETE' });
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function copyTrackingUrl(code: string) {
    const trackingUrl = `${window.location.origin}/api/track/${code}`;
    navigator.clipboard.writeText(trackingUrl).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  const conversionRate = (link: TrackingLink) =>
    link.click_count > 0
      ? ((link.conversion_count / link.click_count) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">링크 관리</h1>
          <p className="text-gray-500 mt-1 text-sm">트래킹 링크를 생성하고 성과를 확인하세요.</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="md">
          <Plus size={16} className="mr-1.5" />
          새 링크 만들기
        </Button>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">새 트래킹 링크 만들기</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">링크 제목</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="예: 갤럭시 S25 링크"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">원본 URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="https://coupang.com/product/..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  계약 연결 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
                <select
                  value={contractId}
                  onChange={(e) => setContractId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="">계약 선택 안함</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.brand_name} ({c.revenue_share}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowForm(false)}
                >
                  취소
                </Button>
                <Button type="submit" loading={creating} className="flex-1">
                  링크 생성
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : links.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">아직 생성된 링크가 없습니다.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-indigo-600 font-medium hover:underline"
            >
              첫 번째 링크 만들기 →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">링크 제목</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">브랜드</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">클릭수</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">전환율</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">수익</th>
                  <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">트래킹 URL</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {links.map((link) => {
                  const expired = isExpired(link.end_date);
                  return (
                    <tr
                      key={link.id}
                      className={`transition-colors ${expired ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{link.title}</span>
                            {expired && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                                <AlertCircle size={10} />
                                만료됨
                              </span>
                            )}
                          </div>
                          
                            href={link.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1 w-fit"
                          >
                            <ExternalLink size={10} />
                            원본 URL
                          </a>
                            <ExternalLink size={10} />
                            원본 URL
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {link.brand_name ? (
                          <span className="text-sm text-gray-600">
                            {link.brand_name}
                            {link.revenue_share != null && (
                              <span className="ml-1.5 text-xs text-emerald-600 font-medium">
                                {link.revenue_share}%
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 italic">미연결</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatNumber(link.click_count)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm text-gray-700">{conversionRate(link)}%</span>
                        <span className="text-xs text-gray-400 ml-1">({link.conversion_count}건)</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatKRW(link.total_commission)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          onClick={() => copyTrackingUrl(link.code)}
                          disabled={expired}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            expired
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600'
                          }`}
                        >
                          {copiedCode === link.code ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              복사됨
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              {link.code}
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
