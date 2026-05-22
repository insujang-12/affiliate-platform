import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TrendingUp, Link2, FileText, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Link2,
    title: '스마트 링크 추적',
    desc: '고유 트래킹 링크로 클릭수와 전환율을 정확하게 추적하세요.',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
  },
  {
    icon: BarChart3,
    title: '실시간 수익 분석',
    desc: '일별/주별/월별 수익 차트로 성과 트렌드를 한눈에 파악하세요.',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
  },
  {
    icon: FileText,
    title: '계약 통합 관리',
    desc: '쿠팡, 네이버 등 다양한 파트너사 계약을 체계적으로 관리하세요.',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
  },
];

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AF</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">어필리에이트</span>
        </div>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            로그인
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            시작하기
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium px-4 py-2 rounded-full mb-6">
          <TrendingUp className="w-4 h-4" />
          한국 어필리에이트 마케팅 관리 플랫폼
        </div>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          어필리에이트 수익을
          <br />
          <span className="text-indigo-600">스마트하게</span> 관리하세요
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          클릭 추적부터 수익 분석, 계약 관리까지. 모든 어필리에이트 활동을 한 곳에서 관리하세요.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/register"
            className="px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            무료로 시작하기
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors border border-gray-200"
          >
            데모 로그인
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc, iconBg, iconText }) => (
            <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
                <Icon className={`w-6 h-6 ${iconText}`} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Brand partner section */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-violet-600 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-violet-200 text-sm font-medium mb-1">브랜드 파트너</p>
            <h2 className="text-2xl font-bold text-white mb-2">카페24 쇼핑몰 운영하시나요?</h2>
            <p className="text-violet-200 text-sm">
              API 연동으로 주문 데이터를 자동 동기화하고 인플루언서 성과를 추적하세요.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link href="/brand/register"
              className="px-6 py-3 bg-white text-violet-700 font-semibold rounded-xl hover:bg-violet-50 transition-colors text-sm">
              브랜드로 가입
            </Link>
            <Link href="/brand/login"
              className="px-6 py-3 bg-violet-500 text-white font-semibold rounded-xl hover:bg-violet-400 transition-colors text-sm">
              브랜드 로그인
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-indigo-600 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">지금 바로 체험해보세요</h2>
          <p className="text-indigo-200 mb-8">데모 계정으로 모든 기능을 미리 체험할 수 있습니다.</p>
          <div className="bg-white/10 rounded-xl p-4 inline-block text-left mb-6">
            <p className="text-white text-sm font-medium mb-1">데모 계정 정보</p>
            <p className="text-indigo-200 text-sm">이메일: demo@example.com</p>
            <p className="text-indigo-200 text-sm">비밀번호: demo1234</p>
          </div>
          <div>
            <Link
              href="/login"
              className="px-8 py-3.5 bg-white text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors inline-block"
            >
              데모 계정으로 로그인
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
