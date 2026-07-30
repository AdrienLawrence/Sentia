import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  hasCurrentLegalConsent,
  parseJsonObject,
  readOptionalBoolean,
  rememberCurrentLegalConsent,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'
import {
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION
} from '@/features/legal/constants'
import { requireAccountNotDeleted } from '@/lib/accountDeletion'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request, {
      requireLegalConsent: false
    })
    await requireAccountNotDeleted(user.id)
    const accepted = await hasCurrentLegalConsent(user.id)

    return NextResponse.json({
      accepted,
      userId: user.id,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      termsOfServiceVersion: TERMS_OF_SERVICE_VERSION
    })
  } catch (error) {
    return apiErrorResponse(
      error,
      'Failed to verify legal acceptance'
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireAuthenticatedUser(request, {
      requireLegalConsent: false
    })
    await requireAccountNotDeleted(user.id)
    const body = await parseJsonObject(request, 2048)

    assertAllowedKeys(body, [
      'privacyAccepted',
      'termsAccepted'
    ])

    const privacyAccepted = readOptionalBoolean(
      body,
      'privacyAccepted'
    )
    const termsAccepted = readOptionalBoolean(
      body,
      'termsAccepted'
    )

    if (privacyAccepted !== true || termsAccepted !== true) {
      throw new ApiRequestError(
        'Both legal documents must be accepted'
      )
    }

    const acceptedAt = new Date()

    await prisma.user.upsert({
      where: {
        id: user.id
      },
      update: {
        email: user.email ?? null,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        privacy_policy_accepted_at: acceptedAt,
        terms_of_service_version: TERMS_OF_SERVICE_VERSION,
        terms_of_service_accepted_at: acceptedAt
      },
      create: {
        id: user.id,
        email: user.email ?? null,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        privacy_policy_accepted_at: acceptedAt,
        terms_of_service_version: TERMS_OF_SERVICE_VERSION,
        terms_of_service_accepted_at: acceptedAt
      }
    })
    rememberCurrentLegalConsent(user.id, true)

    return NextResponse.json({
      accepted: true,
      userId: user.id,
      acceptedAt: acceptedAt.toISOString(),
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      termsOfServiceVersion: TERMS_OF_SERVICE_VERSION
    })
  } catch (error) {
    return apiErrorResponse(
      error,
      'Failed to save legal acceptance'
    )
  }
}
