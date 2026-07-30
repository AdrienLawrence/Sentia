import type { NextRequest } from 'next/server'

import { refreshSupabaseSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return refreshSupabaseSession(request)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/editor/:path*',
    '/quiz/:path*',
    '/login',
    '/reset-password',
    '/auth/:path*'
  ]
}
