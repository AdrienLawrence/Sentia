import { NextResponse } from 'next/server'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  parseJsonObject,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'
import {
  clearPasswordRecoveryMarker,
  hasVerifiedPasswordRecovery
} from '@/lib/passwordRecovery'
import { createClient } from '@/lib/supabase/server'

function requireRecoverySession(request: Request) {
  if (!hasVerifiedPasswordRecovery(request)) {
    throw new ApiRequestError(
      'Password recovery link is invalid or expired',
      401
    )
  }
}

export async function GET(request: Request) {
  try {
    requireRecoverySession(request)
    await requireAuthenticatedUser(request, {
      requireLegalConsent: false
    })

    return NextResponse.json(
      { verified: true },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    return apiErrorResponse(
      error,
      'Failed to verify password recovery'
    )
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    requireRecoverySession(request)
    await requireAuthenticatedUser(request, {
      requireLegalConsent: false
    })

    const body = await parseJsonObject(request, 2048)
    assertAllowedKeys(body, ['password'])

    if (
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128
    ) {
      throw new ApiRequestError(
        'Password must be between 8 and 128 characters'
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
      password: body.password
    })

    if (error) {
      throw new ApiRequestError(
        'Password could not be updated',
        502
      )
    }

    return clearPasswordRecoveryMarker(
      NextResponse.json(
        { updated: true },
        {
          headers: {
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      )
    )
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update password')
  }
}
