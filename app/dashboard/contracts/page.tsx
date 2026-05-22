'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, TrendingUp, Link2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatKRW } from '@/lib/utils';

interface Contract {
  id: number;
  brand_name: string;
  revenue_share: number;
  start_date: string;
  end_date: string;
  status: string;
  link_count: number;
  total_commission: number;
  created_at: string;
}

function isActive(contract: Contract): boolean {
  return new Date(contract.end_date) >= new Date();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [brandName, setBrandName] = useState('');
  const [revenueShare, setRevenueShare] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/contracts');
    const data = await res.json();
    if (Array.isArray(data)) setContracts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_name: brandName,
        revenue_share: parseFloat(revenueShare),
        start_date: startDate,
        end_date: endDate,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setBrandName('');
      setRevenueShare('');
      setStartDate('');
      setEndDate('');
      setShowForm(false);
      fetchContracts();
    }
  }

  const activeCount = contracts.filter(isActive).length;
  const totalRevenue = contracts.reduce((sum, c) => sum + c.total_commission, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계약 관리</h1>
          <p className="text-gray-500 mt-1 text-sm">파트너사와의 계약을 관리하세요.</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="md">
          <Plus size={16} className="mr-1.5" />
          새 계약 추가
        </Button>
      </div>

      {/* Summary bar */}
      {!loading && contracts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">전체 계약</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{contracts.length}건</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">진행중인 계약</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{activeCount}건</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 font-medium">총 누적 수익</p>
            <p className="text-xl font-bold text-indigo-600 mt-1">{formatKRW(totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* Create contract modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">새 계약 추가</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">브랜드명</label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="예: 쿠팡 파트너스"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  수익 분배율 <span className="text-gray-400 font-normal">(%)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={revenueShare}
                  onChange={(e) => setRevenueShare(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="예: 5.0"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>
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
                  계약 추가
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contracts grid */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-100">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">아직 등록된 계약이 없습니다.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-indigo-600 font-medium hover:underline"
          >
            첫 번째 계약 추가하기 →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {contracts.map((contract) => {
            const active = isActive(contract);
            return (
              <div
                key={contract.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{contract.brand_name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <TrendingUp size={13} className="text-indigo-500" />
                      <span className="text-sm font-semibold text-indigo-600">
                        {contract.revenue_share}% 수익 분배
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {active ? '진행중' : '종료'}
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar size={14} className="text-gray-400" />
                  {formatDate(contract.start_date)} ~ {formatDate(contract.end_date)}
                </div>

                {/* Stats */}
                <div className="flex gap-4 pt-1 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <Link2 size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-500">링크 {contract.link_count}개</span>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-gray-400">누적 수익</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatKRW(contract.total_commission)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
