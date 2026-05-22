import { NextRequest, NextResponse } from 'next/server';

// OAuth connect route is no longer used (replaced by client_credentials flow).
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/brand/dashboard/cafe24', req.url));
}
