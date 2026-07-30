import { NextResponse } from 'next/server'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  parseJsonObject,
  readOptionalText,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ACCOUNT_DELETION_TOMBSTONE_TTL_MS,
  hashDeletedAccountId
} from '@/lib/accountDeletion'

const DELETE_CONFIRMATION = 'DELETE'

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request)

    const user = await requireAuthenticatedUser(request, {
      requireLegalConsent: false
    })
    const body = await parseJsonObject(request, 1024)
    assertAllowedKeys(body, ['confirmation'])

    const confirmation = readOptionalText(
      body,
      'confirmation',
      DELETE_CONFIRMATION.length
    )

    if (confirmation !== DELETE_CONFIRMATION) {
      throw new ApiRequestError(
        `Type ${DELETE_CONFIRMATION} to confirm account deletion`
      )
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new ApiRequestError(
        'Account deletion is temporarily unavailable',
        503
      )
    }

    const admin = createAdminClient()
    const deletedAt = new Date()
    const tombstoneExpiresAt = new Date(
      deletedAt.getTime() + ACCOUNT_DELETION_TOMBSTONE_TTL_MS
    )

    await prisma.$transaction(async (transaction) => {
      await transaction.deletedAccountTombstone.deleteMany({
        where: {
          expires_at: {
            lte: deletedAt
          }
        }
      })
      await transaction.deletedAccountTombstone.upsert({
        where: {
          account_hash: hashDeletedAccountId(user.id)
        },
        update: {
          created_at: deletedAt,
          expires_at: tombstoneExpiresAt
        },
        create: {
          account_hash: hashDeletedAccountId(user.id),
          created_at: deletedAt,
          expires_at: tombstoneExpiresAt
        }
      })
      await transaction.user.deleteMany({
        where: {
          id: user.id
        }
      })
      await transaction.apiRateLimit.deleteMany({
        where: {
          key: {
            startsWith: `${user.id}:`
          }
        }
      })
    })

    const { error } = await admin.auth.admin.deleteUser(user.id)

    if (error) {
      console.error('account.auth_deletion_failed', {
        userId: user.id,
        error: error.name
      })
      throw new ApiRequestError(
        'Account data was removed, but sign-in deletion must be retried',
        502
      )
    }

    return NextResponse.json(
      { deleted: true },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    )
  } catch (error) {
    return apiErrorResponse(error, 'Failed to delete account')
  }
}
