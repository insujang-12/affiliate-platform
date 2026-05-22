import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request });
  const { pathname } = request.nextUrl;

  if (!token) {
    const loginUrl = new URL(
      pathname.startsWith('/brand/dashboard') ? '/brand/login' : '/login',
      request.url
    );
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route guard
  if (pathname.startsWith('/brand/dashboard') && token.role !== 'brand') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (pathname.startsWith('/dashboard') && token.role === 'brand') {
    return NextResponse.redirect(new URL('/brand/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/brand/dashboard/:path*'],
};
