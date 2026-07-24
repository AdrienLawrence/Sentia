import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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

// GET /api/notebooks/[id]/pages - Get all pages for a notebook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const pages = await prisma.page.findMany({
      where: {
        notebook_id: notebookId,
        user_id: user.id
      },
      orderBy: {
        page_number: 'asc'
      },
      include: {
        notebook: true
      }
    })

    return NextResponse.json(pages)
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
      'page_number'
    ])
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

    const page = await prisma.$transaction(async (tx) => {
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

      return tx.page.create({
        data: {
          title,
          content,
          page_number: nextPageNumber,
          user_id: user.id,
          notebook_id: notebookId
        }
      })
    })

    return NextResponse.json(page, { status: 201 })
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
      'pendingDeletionPageIds'
    ])
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

    await prisma.$transaction(
      pageIds.map((pageId, index) =>
        prisma.page.update({
          where: {
            id: pageId
          },
          data: {
            page_number: index + 1
          }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to reorder pages')
  }
}
