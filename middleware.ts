import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = { matcher: ['/cliente/:path*', '/atelier/:path*', '/admin/:path*'] };
