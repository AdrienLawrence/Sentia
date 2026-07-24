import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
  parseJsonObject,
  readOptionalEnum,
  readRequiredNumber,
  requireAuthenticatedUser,
  requireSameOrigin,
  validateProperties
} from '@/lib/apiSecurity'

const DRAW_ELEMENT_TYPES = [
  'rectangle',
  'circle',
  'arrow',
  'line',
  'text'
] as const

// POST /api/draw-elements - Add element to draw box
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireAuthenticatedUser(request)
    const body = await parseJsonObject(request, 64_000)
    assertAllowedKeys(body, [
      'draw_box_id',
      'type',
      'x',
      'y',
      'width',
      'height',
      'properties'
    ])

    if (typeof body.draw_box_id !== 'string') {
      throw new ApiRequestError('Invalid draw box ID')
    }

    assertUuid(body.draw_box_id, 'draw box ID')

    const type = readOptionalEnum(
      body,
      'type',
      DRAW_ELEMENT_TYPES
    )

    if (!type) {
      throw new ApiRequestError('type is required')
    }

    const drawBox = await prisma.drawBox.findFirst({
      where: {
        id: body.draw_box_id,
        page: {
          user_id: user.id
        }
      },
      select: {
        id: true
      }
    })

    if (!drawBox) {
      return NextResponse.json(
        { error: 'Draw box not found' },
        { status: 404 }
      )
    }

    const elementCount = await prisma.drawElement.count({
      where: { draw_box_id: body.draw_box_id }
    })

    if (elementCount >= 1000) {
      throw new ApiRequestError('Draw element limit reached', 409)
    }

    const properties = validateProperties(
      body.properties ?? {}
    ) as Prisma.InputJsonValue

    const drawElement = await prisma.drawElement.create({
      data: {
        draw_box_id: body.draw_box_id,
        type,
        x: readRequiredNumber(body, 'x', -100_000, 100_000),
        y: readRequiredNumber(body, 'y', -100_000, 100_000),
        width: readRequiredNumber(body, 'width', 1, 10_000),
        height: readRequiredNumber(body, 'height', 1, 10_000),
        properties
      }
    })

    return NextResponse.json(drawElement, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create draw element')
  }
}
