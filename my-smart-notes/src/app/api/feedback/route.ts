import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  parseJsonObject,
  readOptionalBoolean,
  readOptionalEnum,
  readOptionalNumber,
  readOptionalText,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'

const FEEDBACK_CATEGORIES = [
  'bug',
  'idea',
  'experience',
  'other'
] as const

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)

    const feedback = await prisma.feedback.findMany({
      where: {
        user_id: user.id
      },
      select: {
        id: true,
        category: true,
        message: true,
        rating: true,
        contact_allowed: true,
        status: true,
        created_at: true
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 12
    })

    return NextResponse.json(feedback)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch feedback')
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireAuthenticatedUser(request)
    const body = await parseJsonObject(request, 16_384)

    assertAllowedKeys(body, [
      'category',
      'message',
      'rating',
      'contactAllowed',
      'includeContext',
      'pagePath'
    ])

    const category = readOptionalEnum(
      body,
      'category',
      FEEDBACK_CATEGORIES
    )
    const message = readOptionalText(body, 'message', 2000)
    const rating = readOptionalNumber(body, 'rating', 1, 5)
    const contactAllowed =
      readOptionalBoolean(body, 'contactAllowed') ?? false
    const includeContext =
      readOptionalBoolean(body, 'includeContext') ?? false
    const pagePath = readOptionalText(
      body,
      'pagePath',
      300,
      true
    )

    if (!category) {
      throw new ApiRequestError('Feedback category is required')
    }

    if (!message || message.trim().length < 10) {
      throw new ApiRequestError(
        'Feedback must be at least 10 characters'
      )
    }

    if (pagePath && !pagePath.startsWith('/')) {
      throw new ApiRequestError('Invalid page path')
    }

    await prisma.user.upsert({
      where: {
        id: user.id
      },
      update: {
        email: user.email ?? null
      },
      create: {
        id: user.id,
        email: user.email ?? null
      }
    })

    const context = includeContext
      ? ({
          pagePath: pagePath || '/dashboard',
          userAgent: sanitizeHeader(
            request.headers.get('user-agent')
          )
        } as Prisma.InputJsonValue)
      : undefined

    const feedback = await prisma.feedback.create({
      data: {
        user_id: user.id,
        category,
        message: message.trim(),
        rating,
        contact_allowed: contactAllowed,
        context
      },
      select: {
        id: true,
        category: true,
        message: true,
        rating: true,
        contact_allowed: true,
        status: true,
        created_at: true
      }
    })

    return NextResponse.json(feedback, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to submit feedback')
  }
}

function sanitizeHeader(value: string | null) {
  return (value || 'Unknown')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 300)
}
