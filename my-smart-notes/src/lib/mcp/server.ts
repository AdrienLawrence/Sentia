import { McpServer, type AuthInfo } from '@modelcontextprotocol/server'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'

import {
  markdownToTiptapDocument
} from '@/features/file-transfer/lib/content'
import { tiptapDocumentToMarkdown } from '@/features/file-transfer/lib/markdown'
import { ApiRequestError, validateTiptapDocument } from '@/lib/apiSecurity'
import { claimNotebookRevision } from '@/lib/notebookRevision'
import { prisma } from '@/lib/prisma'
import { createNotebook } from '@/lib/createNotebook'

const MAX_MCP_MARKDOWN_LENGTH = 50_000

const createNotebookInput = z.object({
  title: z.string().trim().min(1).max(100)
    .regex(
      /^[^\u0000-\u001f\u007f]*$/,
      'Title must not contain control characters'
    ),
  requestId: z.string().uuid().transform((value) => value.toLowerCase())
}).strict()

function principalUserId(authInfo?: AuthInfo) {
  const userId = authInfo?.extra?.userId

  if (typeof userId !== 'string') {
    throw new ApiRequestError('Unauthorized', 401)
  }

  return userId
}

function result(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  }
}

function toolError(error: unknown) {
  const message =
    error instanceof ApiRequestError
      ? error.message
      : 'The Sentia operation could not be completed.'

  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }]
  }
}

function appendDocuments(existing: unknown, markdown: string) {
  const current = validateTiptapDocument(existing) as {
    type: string
    content?: unknown[]
  }
  const addition = validateTiptapDocument(
    markdownToTiptapDocument(markdown)
  ) as {
    type: string
    content?: unknown[]
  }

  return validateTiptapDocument({
    type: 'doc',
    content: [
      ...(current.content ?? []),
      ...(addition.content ?? [])
    ]
  }) as Prisma.InputJsonValue
}

export function createSentiaMcpServer(authInfo?: AuthInfo) {
  const userId = principalUserId(authInfo)
  const server = new McpServer({
    name: 'Sentia',
    version: '1.0.0'
  })

  server.registerTool(
    'list_notebooks',
    {
      title: 'List Sentia notebooks',
      description:
        'List notebooks owned by the connected Sentia user. Use the returned exact notebook ID for later tools.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async () => {
      try {
        const notebooks = await prisma.notebook.findMany({
          where: { user_id: userId },
          orderBy: { last_opened_at: 'desc' },
          select: {
            id: true,
            name: true,
            revision: true,
            last_opened_at: true,
            _count: { select: { pages: true } }
          }
        })

        return result(notebooks)
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'create_notebook',
    {
      title: 'Create a Sentia notebook',
      description:
        'Create one empty notebook owned by the connected user. Supply a fresh UUID requestId for each intended notebook and reuse it after an uncertain response. Returns its ID, name, and revision for create_page.',
      inputSchema: createNotebookInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ title, requestId }) => {
      try {
        const created = await createNotebook({
          userId,
          name: title,
          style: 'blank',
          createInitialPage: false,
          mcpRequestId: requestId
        })
        return result({
          notebook: {
            id: created.notebook.id,
            name: created.notebook.name,
            revision: created.notebook.revision
          },
          created: created.created
        })
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'list_pages',
    {
      title: 'List notebook pages',
      description:
        'List the pages in one owned notebook without returning their content.',
      inputSchema: z.object({
        notebookId: z.string().uuid()
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ notebookId }) => {
      try {
        const notebook = await prisma.notebook.findFirst({
          where: { id: notebookId, user_id: userId },
          select: {
            id: true,
            name: true,
            revision: true,
            pages: {
              orderBy: { page_number: 'asc' },
              select: {
                id: true,
                title: true,
                page_number: true,
                updated_at: true
              }
            }
          }
        })

        if (!notebook) {
          throw new ApiRequestError('Notebook not found', 404)
        }

        return result(notebook)
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'read_page',
    {
      title: 'Read a Sentia page',
      description:
        'Read one owned page as Markdown and return its notebook revision for conflict-safe writes.',
      inputSchema: z.object({
        pageId: z.string().uuid()
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true
      }
    },
    async ({ pageId }) => {
      try {
        const page = await prisma.page.findFirst({
          where: { id: pageId, user_id: userId },
          select: {
            id: true,
            title: true,
            page_number: true,
            content: true,
            notebook: {
              select: { id: true, name: true, revision: true }
            }
          }
        })

        if (!page?.notebook) {
          throw new ApiRequestError('Page not found', 404)
        }

        return result({
          id: page.id,
          title: page.title,
          pageNumber: page.page_number,
          notebook: page.notebook,
          markdown: tiptapDocumentToMarkdown(page.content)
        })
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'create_page',
    {
      title: 'Create a Sentia page',
      description:
        'Create a page at the end of an owned notebook using bounded Markdown formatting. Requires the latest notebook revision from list_pages.',
      inputSchema: z.object({
        notebookId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
        title: z.string().trim().min(1).max(200),
        markdown: z.string().max(MAX_MCP_MARKDOWN_LENGTH).default('')
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false
      }
    },
    async ({ notebookId, expectedRevision, title, markdown }) => {
      try {
        const created = await prisma.$transaction(async (transaction) => {
          const notebook = await transaction.notebook.findFirst({
            where: { id: notebookId, user_id: userId },
            select: { id: true }
          })

          if (!notebook) {
            throw new ApiRequestError('Notebook not found', 404)
          }

          const pageCount = await transaction.page.count({
            where: { notebook_id: notebookId, user_id: userId }
          })

          if (pageCount >= 1000) {
            throw new ApiRequestError('Page limit reached', 409)
          }

          const revision = await claimNotebookRevision(
            transaction,
            notebookId,
            userId,
            expectedRevision
          )
          const lastPage = await transaction.page.findFirst({
            where: { notebook_id: notebookId, user_id: userId },
            orderBy: { page_number: 'desc' },
            select: { page_number: true }
          })
          const page = await transaction.page.create({
            data: {
              title,
              content: validateTiptapDocument(
                markdownToTiptapDocument(markdown)
              ) as Prisma.InputJsonValue,
              page_number: (lastPage?.page_number ?? 0) + 1,
              notebook_id: notebookId,
              user_id: userId
            },
            select: { id: true, title: true, page_number: true }
          })

          return { page, revision }
        })

        return result(created)
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'append_to_page',
    {
      title: 'Append to a Sentia page',
      description:
        'Append bounded formatted Markdown to an owned page without replacing existing notes. Requires the latest notebook revision from read_page or list_pages.',
      inputSchema: z.object({
        pageId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
        markdown: z.string().trim().min(1).max(MAX_MCP_MARKDOWN_LENGTH)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false
      }
    },
    async ({ pageId, expectedRevision, markdown }) => {
      try {
        const updated = await prisma.$transaction(async (transaction) => {
          const page = await transaction.page.findFirst({
            where: { id: pageId, user_id: userId },
            select: {
              id: true,
              notebook_id: true,
              content: true
            }
          })

          if (!page?.notebook_id) {
            throw new ApiRequestError('Page not found', 404)
          }

          const revision = await claimNotebookRevision(
            transaction,
            page.notebook_id,
            userId,
            expectedRevision
          )
          const updatedPage = await transaction.page.update({
            where: { id: page.id },
            data: { content: appendDocuments(page.content, markdown) },
            select: { id: true, title: true, updated_at: true }
          })

          return { page: updatedPage, revision }
        })

        return result(updated)
      } catch (error) {
        return toolError(error)
      }
    }
  )

  server.registerTool(
    'update_page',
    {
      title: 'Update a Sentia page',
      description:
        'Replace the Markdown content of an owned page, optionally rename it, and preserve newer edits through a required notebook revision check. Use only after the user has approved replacing that page.',
      inputSchema: z.object({
        pageId: z.string().uuid(),
        expectedRevision: z.number().int().nonnegative(),
        title: z.string().trim().min(1).max(200).optional(),
        markdown: z.string().max(MAX_MCP_MARKDOWN_LENGTH)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false
      }
    },
    async ({ pageId, expectedRevision, title, markdown }) => {
      try {
        const updated = await prisma.$transaction(async (transaction) => {
          const page = await transaction.page.findFirst({
            where: { id: pageId, user_id: userId },
            select: { id: true, notebook_id: true }
          })

          if (!page?.notebook_id) {
            throw new ApiRequestError('Page not found', 404)
          }

          const revision = await claimNotebookRevision(
            transaction,
            page.notebook_id,
            userId,
            expectedRevision
          )
          const updatedPage = await transaction.page.update({
            where: { id: page.id },
            data: {
              ...(title !== undefined && { title }),
              content: validateTiptapDocument(
                markdownToTiptapDocument(markdown)
              ) as Prisma.InputJsonValue
            },
            select: { id: true, title: true, updated_at: true }
          })

          return { page: updatedPage, revision }
        })

        return result(updated)
      } catch (error) {
        return toolError(error)
      }
    }
  )

  return server
}
