import { NextResponse } from 'next/server'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  enforcePublicRecoveryRateLimit,
  parseJsonObject,
  requireSameOrigin
} from '@/lib/apiSecurity'
import { createClient } from '@/lib/supabase/server'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NEUTRAL_RECOVERY_MESSAGE =
  'If that address has a password account, a recovery link has been sent.'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)

    const body = await parseJsonObject(request, 2048)
    assertAllowedKeys(body, ['email', 'website'])

    if (
      typeof body.email !== 'string' ||
      body.email.length > 254
    ) {
      throw new ApiRequestError('Enter a valid email address')
    }

    const normalizedEmail = body.email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      throw new ApiRequestError('Enter a valid email address')
    }

    if (
      body.website !== undefined &&
      typeof body.website !== 'string'
    ) {
      throw new ApiRequestError('Invalid recovery request')
    }

    await enforcePublicRecoveryRateLimit(request, normalizedEmail)

    if (!body.website) {
      const supabase = await createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password&flow=recovery`
        }
      )

      if (error) {
        console.warn('password_recovery.delivery_failed', {
          error: error.name
        })
      }
    }

    return NextResponse.json(
      {
        sent: true,
        message: NEUTRAL_RECOVERY_MESSAGE
      },
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    return apiErrorResponse(
      error,
      'Password recovery could not be requested'
    )
  }
}
