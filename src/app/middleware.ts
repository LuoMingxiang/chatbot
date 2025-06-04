import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession(); // ★ 必须执行，不然不会同步 cookie → SSR 和客户端都拿不到 user
  return res;
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'] // 全站开启，或指定 /protected 路由
};
