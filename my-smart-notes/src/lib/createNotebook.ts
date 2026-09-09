import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

import { ApiRequestError } from '@/lib/apiSecurity'
import { prisma } from '@/lib/prisma'

const NOTEBOOK_LIMIT = 200
const MCP_HOURLY_CREATION_LIMIT = 20
const MCP_CREATE_OPERATION = 'create_notebook'

export type NotebookStyle = 'blank' | 'standard' | 'composition' | 'grid'

type CreateNotebookOptions = {
  userId: string
  name: string
  style: NotebookStyle
  createInitialPage: boolean
  mcpRequestId?: string
}

function inputHash(options: CreateNotebookOptions) {
  return createHash('sha256')
    .update(JSON.stringify({
      name: options.name,
      style: options.style,
      createInitialPage: options.createInitialPage
    }))
    .digest('hex')
}

function isRetryable(error: unknown, allowUniqueConflict: boolean) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false
  }
  return error.code === 'P2034' || (allowUniqueConflict && error.code === 'P2002')
}

async function replayMcpRequest(
  tx: Prisma.TransactionClient,
  userId: string,
  requestId: string,
  expectedHash: string
) {
  const record = await tx.mcpIdempotencyRecord.findUnique({
    where: {
      user_id_operation_request_id: {
        user_id: userId,
        operation: MCP_CREATE_OPERATION,
        request_id: requestId
      }
    }
  })

  if (!record) return null
  if (record.input_hash !== expectedHash) {
    throw new ApiRequestError(
      'This request ID was already used with different notebook options.',
      409
    )
  }

  const notebook = await tx.notebook.findFirst({
    where: { id: record.resource_id, user_id: userId },
    select: { id: true, name: true, revision: true }
  })
  if (!notebook) {
    throw new ApiRequestError(
      'The notebook created by this request was deleted. Use a new request ID only if you intend to create another notebook.',
      410
    )
  }

  return { notebook, initialPageId: null, created: false }
}

async function chargeMcpCreationBudget(
  tx: Prisma.TransactionClient,
  userId: string
) {
  const now = new Date()
  const windowStart = new Date(
    Math.floor(now.getTime() / 3_600_000) * 3_600_000
  )
  const key = `${userId}:MCP:${MCP_CREATE_OPERATION}`
  const current = await tx.apiRateLimit.findUnique({ where: { key } })
  const sameWindow = Boolean(current && current.window_started_at >= windowStart)

  if (sameWindow && current!.count >= MCP_HOURLY_CREATION_LIMIT) {
    throw new ApiRequestError(
      'Notebook creation limit reached. Try again next hour.',
      429
    )
  }

  await tx.apiRateLimit.upsert({
    where: { key },
    create: { key, window_started_at: windowStart, count: 1 },
    update: sameWindow
      ? { count: { increment: 1 } }
      : { window_started_at: windowStart, count: 1 }
  })
}

export async function createNotebook(options: CreateNotebookOptions) {
  const requestHash = options.mcpRequestId ? inputHash(options) : null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        if (options.mcpRequestId && requestHash) {
          const replay = await replayMcpRequest(
            tx,
            options.userId,
            options.mcpRequestId,
            requestHash
          )
          if (replay) return replay
        }

        const count = await tx.notebook.count({
          where: { user_id: options.userId }
        })
        if (count >= NOTEBOOK_LIMIT) {
          throw new ApiRequestError('Notebook limit reached', 409)
        }

        if (options.mcpRequestId) {
          await chargeMcpCreationBudget(tx, options.userId)
        }

        const notebook = await tx.notebook.create({
          data: {
            name: options.name,
            style: options.style,
            user_id: options.userId,
            revision: options.createInitialPage ? 1 : 0
          }
        })

        let initialPageId: string | null = null
        if (options.createInitialPage) {
          const page = await tx.page.create({
            data: {
              title: 'Untitled Page',
              content: { type: 'doc', content: [] },
              page_number: 1,
              user_id: options.userId,
              notebook_id: notebook.id
            },
            select: { id: true }
          })
          initialPageId = page.id
        }

        if (options.mcpRequestId && requestHash) {
          await tx.mcpIdempotencyRecord.create({
            data: {
              user_id: options.userId,
              operation: MCP_CREATE_OPERATION,
              request_id: options.mcpRequestId,
              input_hash: requestHash,
              resource_id: notebook.id
            }
          })
        }

        return { notebook, initialPageId, created: true }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!isRetryable(error, Boolean(options.mcpRequestId))) throw error
      if (attempt === 2) {
        throw new ApiRequestError(
          'Notebook creation is busy. Retry with the same request ID.',
          409
        )
      }
    }
  }

  throw new ApiRequestError('Notebook creation could not be completed', 500)
}
