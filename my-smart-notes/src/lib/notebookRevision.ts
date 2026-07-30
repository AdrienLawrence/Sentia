import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import {
  ApiRequestError,
  readRequiredNumber
} from '@/lib/apiSecurity'
import { NOTEBOOK_REVISION_HEADER } from '@/lib/notebookRevisionShared'

export function readExpectedRevision(
  body: Record<string, unknown>
) {
  return readRequiredNumber(
    body,
    'expectedRevision',
    0,
    Number.MAX_SAFE_INTEGER
  )
}

export async function claimNotebookRevision(
  transaction: Prisma.TransactionClient,
  notebookId: string,
  userId: string,
  expectedRevision: number
) {
  const result = await transaction.notebook.updateMany({
    where: {
      id: notebookId,
      user_id: userId,
      revision: expectedRevision
    },
    data: {
      revision: {
        increment: 1
      }
    }
  })

  if (result.count !== 1) {
    throw new ApiRequestError(
      'A newer notebook version is available. Refresh before editing.',
      409
    )
  }

  return expectedRevision + 1
}

export function revisionResponse(
  payload: unknown,
  revision: number,
  status = 200
) {
  return NextResponse.json(payload, {
    status,
    headers: {
      [NOTEBOOK_REVISION_HEADER]: String(revision)
    }
  })
}
