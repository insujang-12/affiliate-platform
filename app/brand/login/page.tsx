'use client';
import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function BrandLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role;
      router.push(role === 'brand' ? '/brand/dashboard' : '/dashboard');
    }
  }, [status, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } else {
      router.push('/brand/dashboard');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex w-14 h-14 bg-violet-600 rounded-2xl items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">BR</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">브랜드 로그인</h1>
          <p className="text-gray-500 mt-1 text-sm">브랜드 파트너 계정으로 로그인하세요</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="브랜드 이메일"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="비밀번호"
                required
              />
            </div>
            <Button
              type="submit"
              loading={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 focus:ring-violet-500"
              size="lg"
            >
              로그인
            </Button>
          </form>

          <div className="mt-5 p-4 bg-violet-50 rounded-xl border border-violet-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-violet-700 mb-1">데모 브랜드 계정</p>
                <p className="text-xs text-violet-600">brand@example.com / brand1234</p>
              </div>
              <button
                type="button"
                onClick={() => { setEmail('brand@example.com'); setPassword('brand1234'); }}
                className="text-xs font-medium text-violet-600 hover:text-violet-800 underline"
              >
                자동입력
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          브랜드 계정이 없으신가요?{' '}
          <Link href="/brand/register" className="text-violet-600 font-medium hover:underline">
            브랜드 가입
          </Link>
        </p>
        <p className="text-center text-sm text-gray-400 mt-2">
          인플루언서이신가요?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline">
            인플루언서 로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
