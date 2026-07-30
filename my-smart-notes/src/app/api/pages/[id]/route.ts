import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { privateConditionalJson } from '@/lib/httpCache'
import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
  parseJsonObject,
  readOptionalText,
  requireAuthenticatedUser,
  requireSameOrigin,
  validateTiptapDocument
} from '@/lib/apiSecurity'
import {
  claimNotebookRevision,
  readExpectedRevision,
  revisionResponse
} from '@/lib/notebookRevision'

// GET /api/pages/[id] - Get single page with all content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    assertUuid(id, 'page ID')
    const user = await requireAuthenticatedUser(request)
    
    const page = await prisma.page.findFirst({
      where: {
        id,
        user_id: user.id
      },
      include: {
        notebook: true,  // Include notebook info
        draw_boxes: {
          include: {
            elements: true
          }
        }
      }
    })

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return privateConditionalJson(
      request,
      page,
      `${user.id}:page:${id}`
    )
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch page')
  }
}

// PATCH /api/pages/[id] - Update page content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id } = await params
    assertUuid(id, 'page ID')
    const user = await requireAuthenticatedUser(request)

    const existingPage = await prisma.page.findFirst({
      where: {
        id,
        user_id: user.id
      },
      select: {
        id: true,
        notebook_id: true
      }
    })

    if (!existingPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const body = await parseJsonObject(request)
    assertAllowedKeys(body, [
      'content',
      'title',
      'expectedRevision'
    ])
    const expectedRevision = readExpectedRevision(body)

    if (
      body.content === undefined &&
      body.title === undefined
    ) {
      throw new ApiRequestError('No valid fields provided')
    }

    const title = readOptionalText(
      body,
      'title',
      200,
      true
    )
    const content =
      body.content === undefined
        ? undefined
        : (validateTiptapDocument(
            body.content
          ) as Prisma.InputJsonValue)

    if (!existingPage.notebook_id) {
      throw new ApiRequestError('Page is not attached to a notebook')
    }

    const { page, revision } = await prisma.$transaction(async (tx) => {
      const revision = await claimNotebookRevision(
        tx,
        existingPage.notebook_id!,
        user.id,
        expectedRevision
      )
      const page = await tx.page.update({
        where: { id },
        data: {
          content,
          title,
          updated_at: new Date()
        }
      })

      return { page, revision }
    })

    return revisionResponse(page, revision)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update page')
  }
}

// DELETE /api/pages/[id] - Delete page
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id } = await params
    assertUuid(id, 'page ID')
    const user = await requireAuthenticatedUser(request)

    const existingPage = await prisma.page.findFirst({
      where: {
        id,
        user_id: user.id
      },
      select: {
        id: true,
        notebook_id: true
      }
    })

    if (!existingPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    if (!existingPage.notebook_id) {
      throw new ApiRequestError('Page is not attached to a notebook')
    }

    const body = await parseJsonObject(request, 16_384)
    assertAllowedKeys(body, ['expectedRevision'])
    const expectedRevision = readExpectedRevision(body)

    const revision = await prisma.$transaction(async (tx) => {
      const revision = await claimNotebookRevision(
        tx,
        existingPage.notebook_id!,
        user.id,
        expectedRevision
      )
      await tx.page.delete({
        where: { id }
      })
      return revision
    })

    return revisionResponse({ message: 'Page deleted' }, revision)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to delete page')
  }
}
