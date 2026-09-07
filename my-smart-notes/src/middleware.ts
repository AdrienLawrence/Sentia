import { NextResponse, type NextRequest } from 'next/server'

import { refreshSupabaseSession } from '@/lib/supabase/middleware'
import {
  isMaintenanceExemptPath,
  isMaintenanceModeEnabled,
  maintenanceResponse
} from '@/lib/maintenance'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    isMaintenanceModeEnabled() &&
    !isMaintenanceExemptPath(pathname)
  ) {
    return maintenanceResponse(request)
  }

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/editor') ||
    pathname.startsWith('/quiz') ||
    pathname === '/login' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/oauth') ||
    pathname.startsWith('/legal')
  ) {
    return refreshSupabaseSession(request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sentia-mark.svg|sentia-mark.png|robots.txt|sitemap.xml|opengraph-image).*)'
  ]
}
