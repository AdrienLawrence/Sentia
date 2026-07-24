import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedPath = requestUrl.searchParams.get('next')
  const nextPath = isSafeInternalPath(requestedPath)
    ? requestedPath
    : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(
        new URL(nextPath, requestUrl.origin)
      )
    }
  }

  return NextResponse.redirect(
    new URL('/login?oauth=failed', requestUrl.origin)
  )
}

function isSafeInternalPath(value: string | null): value is string {
  return Boolean(
    value &&
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('\\')
  )
}
