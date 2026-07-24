import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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

    return NextResponse.json(page)
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
      select: { id: true }
    })

    if (!existingPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const body = await parseJsonObject(request)
    assertAllowedKeys(body, ['content', 'title'])

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

    const page = await prisma.page.update({
      where: { id },
      data: {
        content,
        title,
        updated_at: new Date()
      }
    })

    return NextResponse.json(page)
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
      select: { id: true }
    })

    if (!existingPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    await prisma.page.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Page deleted' })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to delete page')
  }
}
