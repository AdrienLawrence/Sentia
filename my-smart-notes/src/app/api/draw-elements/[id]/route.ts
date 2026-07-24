import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
  parseJsonObject,
  readOptionalNumber,
  requireAuthenticatedUser,
  requireSameOrigin,
  validateProperties
} from '@/lib/apiSecurity'

// GET /api/draw-elements/[id] - Get single draw element
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    assertUuid(id, 'draw element ID')
    const user = await requireAuthenticatedUser(request)
    
    const drawElement = await prisma.drawElement.findFirst({
      where: {
        id,
        draw_box: {
          page: {
            user_id: user.id
          }
        }
      }
    })

    if (!drawElement) {
      return NextResponse.json({ error: 'Draw element not found' }, { status: 404 })
    }

    return NextResponse.json(drawElement)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch draw element')
  }
}

// PATCH /api/draw-elements/[id] - Update draw element
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id } = await params
    assertUuid(id, 'draw element ID')
    const user = await requireAuthenticatedUser(request)

    const existingElement = await prisma.drawElement.findFirst({
      where: {
        id,
        draw_box: {
          page: {
            user_id: user.id
          }
        }
      },
      select: {
        id: true
      }
    })

    if (!existingElement) {
      return NextResponse.json(
        { error: 'Draw element not found' },
        { status: 404 }
      )
    }

    const body = await parseJsonObject(request, 64_000)
    assertAllowedKeys(body, [
      'x',
      'y',
      'width',
      'height',
      'properties'
    ])

    if (Object.keys(body).length === 0) {
      throw new ApiRequestError('No valid fields provided')
    }

    const properties =
      body.properties === undefined
        ? undefined
        : (validateProperties(
            body.properties
          ) as Prisma.InputJsonValue)

    const drawElement = await prisma.drawElement.update({
      where: { id },
      data: {
        x: readOptionalNumber(body, 'x', -100_000, 100_000),
        y: readOptionalNumber(body, 'y', -100_000, 100_000),
        width: readOptionalNumber(body, 'width', 1, 10_000),
        height: readOptionalNumber(body, 'height', 1, 10_000),
        properties
      }
    })

    return NextResponse.json(drawElement)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update draw element')
  }
}

// DELETE /api/draw-elements/[id] - Delete draw element
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id } = await params
    assertUuid(id, 'draw element ID')
    const user = await requireAuthenticatedUser(request)

    const existingElement = await prisma.drawElement.findFirst({
      where: {
        id,
        draw_box: {
          page: {
            user_id: user.id
          }
        }
      },
      select: {
        id: true
      }
    })

    if (!existingElement) {
      return NextResponse.json(
        { error: 'Draw element not found' },
        { status: 404 }
      )
    }

    await prisma.drawElement.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Draw element deleted' })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to delete draw element')
  }
}
