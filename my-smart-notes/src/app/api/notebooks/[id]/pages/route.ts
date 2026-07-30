import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { privateConditionalJson } from '@/lib/httpCache'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
  assertUuidArray,
  parseJsonObject,
  readOptionalLabel,
  readOptionalNumber,
  requireAuthenticatedUser,
  requireSameOrigin,
  validateTiptapDocument
} from '@/lib/apiSecurity'
import {
  claimNotebookRevision,
  readExpectedRevision,
  revisionResponse
} from '@/lib/notebookRevision'

// GET /api/notebooks/[id]/pages
// summary: page directory only
// content: bounded page content batch selected by IDs
// full: complete notebook content for explicit bulk operations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notebookId } = await params
    assertUuid(notebookId, 'notebook ID')
    const user = await requireAuthenticatedUser(request)
    const searchParams = new URL(request.url).searchParams
    const view = searchParams.get('view') ?? 'full'

    if (!['full', 'summary', 'content'].includes(view)) {
      throw new ApiRequestError('Invalid page view')
    }

    const requestedIds =
      view === 'content'
        ? assertUuidArray(
            (searchParams.get('ids') ?? '')
              .split(',')
              .filter(Boolean),
            'page IDs',
            8
          )
        : []

    if (view === 'content' && requestedIds.length === 0) {
      throw new ApiRequestError('At least one page ID is required')
    }

    const notebookPromise = prisma.notebook.findFirst({
      where: {
        id: notebookId,
        user_id: user.id
      },
      select: {
        id: true
      }
    })

    const pagesPromise =
      view === 'summary'
        ? prisma.page.findMany({
            where: {
              notebook_id: notebookId,
              user_id: user.id
            },
            orderBy: {
              page_number: 'asc'
            },
            select: {
              id: true,
              title: true,
              page_number: true,
              notebook_id: true,
              created_at: true,
              updated_at: true
            }
          })
        : prisma.page.findMany({
            where: {
              notebook_id: notebookId,
              user_id: user.id,
              ...(view === 'content'
                ? {
                    id: {
                      in: requestedIds
                    }
                  }
                : {})
            },
            orderBy: {
              page_number: 'asc'
            },
            ...(view === 'content'
              ? {
                  include: {
                    draw_boxes: {
                      include: {
                        elements: true
                      }
                    }
                  }
                }
              : {})
          })

    const [notebook, loadedPages] = await Promise.all([
      notebookPromise,
      pagesPromise
    ])

    if (!notebook) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 }
      )
    }

    const pages =
      view === 'content'
        ? requestedIds
            .map((pageId) =>
              loadedPages.find(
                (loadedPage) => loadedPage.id === pageId
              )
            )
            .filter((loadedPage) => loadedPage !== undefined)
        : loadedPages

    return privateConditionalJson(
      request,
      pages,
      `${user.id}:notebook:${notebookId}:pages:${view}:${requestedIds.join(',')}`
    )
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch pages')
  }
}

// POST /api/notebooks/[id]/pages - Create a page in a notebook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id: notebookId } = await params
    assertUuid(notebookId, 'notebook ID')
    const user = await requireAuthenticatedUser(request)

    const notebook = await prisma.notebook.findFirst({
      where: {
        id: notebookId,
        user_id: user.id
      },
      select: {
        id: true
      }
    })

    if (!notebook) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 }
      )
    }

    const pageCount = await prisma.page.count({
      where: {
        notebook_id: notebookId,
        user_id: user.id
      }
    })

    if (pageCount >= 1000) {
      throw new ApiRequestError('Page limit reached', 409)
    }

    const body = await parseJsonObject(request)
    assertAllowedKeys(body, [
      'title',
      'content',
      'page_number',
      'expectedRevision'
    ])
    const expectedRevision = readExpectedRevision(body)
    readOptionalNumber(body, 'page_number', 1, 100_000)

    const title =
      readOptionalLabel(body, 'title', 200) ?? 'Untitled Page'

    const content =
      body.content !== undefined
        ? (validateTiptapDocument(
            body.content
          ) as Prisma.InputJsonValue)
        : {
            type: 'doc',
            content: []
          }

    const { page, revision } = await prisma.$transaction(async (tx) => {
      const revision = await claimNotebookRevision(
        tx,
        notebookId,
        user.id,
        expectedRevision
      )
      const lastPage = await tx.page.findFirst({
        where: {
          notebook_id: notebookId,
          user_id: user.id
        },
        orderBy: {
          page_number: 'desc'
        },
        select: {
          page_number: true
        }
      })

      const nextPageNumber =
        (lastPage?.page_number ?? 0) + 1

      const page = await tx.page.create({
        data: {
          title,
          content,
          page_number: nextPageNumber,
          user_id: user.id,
          notebook_id: notebookId
        }
      })

      return { page, revision }
    })

    return revisionResponse(page, revision, 201)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create page')
  }
}

// PATCH /api/notebooks/[id]/pages - Reorder pages in a notebook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id: notebookId } = await params
    assertUuid(notebookId, 'notebook ID')
    const user = await requireAuthenticatedUser(request)

    const notebook = await prisma.notebook.findFirst({
      where: {
        id: notebookId,
        user_id: user.id
      },
      select: {
        id: true
      }
    })

    if (!notebook) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 }
      )
    }

    const body = await parseJsonObject(request, 128_000)
    assertAllowedKeys(body, [
      'pageIds',
      'pendingDeletionPageIds',
      'expectedRevision'
    ])
    const expectedRevision = readExpectedRevision(body)
    const pageIds = assertUuidArray(body.pageIds, 'pageIds')
    const pendingDeletionPageIds = assertUuidArray(
      body.pendingDeletionPageIds,
      'pendingDeletionPageIds'
    )
    const submittedPageIds = [
      ...pageIds,
      ...pendingDeletionPageIds
    ]

    const notebookPages = await prisma.page.findMany({
      where: {
        notebook_id: notebookId,
        user_id: user.id
      },
      select: {
        id: true
      }
    })

    const notebookPageIds = new Set(
      notebookPages.map((page) => page.id)
    )

    if (
      new Set(submittedPageIds).size !== submittedPageIds.length ||
      submittedPageIds.length !== notebookPages.length ||
      submittedPageIds.some(
        (pageId) => !notebookPageIds.has(pageId)
      )
    ) {
      return NextResponse.json(
        { error: 'Page order does not match notebook pages' },
        { status: 400 }
      )
    }

    const revision = await prisma.$transaction(async (tx) => {
      const revision = await claimNotebookRevision(
        tx,
        notebookId,
        user.id,
        expectedRevision
      )

      await Promise.all(
        pageIds.map((pageId, index) =>
          tx.page.update({
            where: {
              id: pageId
            },
            data: {
              page_number: index + 1
            }
          })
        )
      )

      return revision
    })

    return revisionResponse({ success: true }, revision)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to reorder pages')
  }
}
