import type { EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { markPasswordRecoveryVerified } from '@/lib/passwordRecovery'

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get(
    'type'
  ) as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    })

    if (!error) {
      const response = NextResponse.redirect(
        new URL(
          type === 'recovery' ? '/reset-password' : '/dashboard',
          request.url
        )
      )

      return type === 'recovery'
        ? markPasswordRecoveryVerified(response)
        : response
    }
  }

  return NextResponse.redirect(
    new URL(
      type === 'recovery'
        ? '/forgot-password?recovery=failed'
        : '/login?confirmation=failed',
      request.url
    )
  )
}
