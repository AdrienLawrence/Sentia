import { createHash } from 'node:crypto'

import { ApiRequestError } from '@/lib/apiSecurity'
import { prisma } from '@/lib/prisma'

export const ACCOUNT_DELETION_TOMBSTONE_TTL_MS =
  24 * 60 * 60 * 1000

export function hashDeletedAccountId(userId: string) {
  return createHash('sha256')
    .update(`sentia:deleted-account:${userId}`)
    .digest('hex')
}

export async function requireAccountNotDeleted(userId: string) {
  const tombstone = await prisma.deletedAccountTombstone.findUnique({
    where: {
      account_hash: hashDeletedAccountId(userId)
    },
    select: {
      expires_at: true
    }
  })

  if (tombstone && tombstone.expires_at > new Date()) {
    throw new ApiRequestError('Account has been deleted', 401)
  }
}
