import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
  parseJsonObject,
  readRequiredNumber,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'

// POST /api/draw-boxes - Create new draw box on a page
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireAuthenticatedUser(request)
    const body = await parseJsonObject(request, 32_768)
    assertAllowedKeys(body, [
      'page_id',
      'x_position',
      'y_position',
      'width',
      'height'
    ])

    if (typeof body.page_id !== 'string') {
      throw new ApiRequestError('Invalid page ID')
    }

    assertUuid(body.page_id, 'page ID')

    const page = await prisma.page.findFirst({
      where: {
        id: body.page_id,
        user_id: user.id
      },
      select: {
        id: true
      }
    })

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }
    
    const drawBoxCount = await prisma.drawBox.count({
      where: { page_id: body.page_id }
    })

    if (drawBoxCount >= 200) {
      throw new ApiRequestError('Draw box limit reached', 409)
    }

    const drawBox = await prisma.drawBox.create({
      data: {
        page_id: body.page_id,
        x_position: readRequiredNumber(
          body,
          'x_position',
          -100_000,
          100_000
        ),
        y_position: readRequiredNumber(
          body,
          'y_position',
          -100_000,
          100_000
        ),
        width: readRequiredNumber(body, 'width', 1, 10_000),
        height: readRequiredNumber(body, 'height', 1, 10_000)
      }
    })

    return NextResponse.json(drawBox, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create draw box')
  }
}
