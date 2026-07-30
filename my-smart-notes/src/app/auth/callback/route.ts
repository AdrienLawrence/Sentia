import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { markPasswordRecoveryVerified } from '@/lib/passwordRecovery'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const flow = requestUrl.searchParams.get('flow')
  const requestedPath = requestUrl.searchParams.get('next')
  const nextPath = isSafeInternalPath(requestedPath)
    ? requestedPath
    : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const response = NextResponse.redirect(
        new URL(nextPath, requestUrl.origin)
      )

      return flow === 'recovery'
        ? markPasswordRecoveryVerified(response)
        : response
    }
  }

  return NextResponse.redirect(
    new URL(
      flow === 'recovery'
        ? '/forgot-password?recovery=failed'
        : flow === 'email'
        ? '/login?confirmation=failed'
        : '/login?oauth=failed',
      requestUrl.origin
    )
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
