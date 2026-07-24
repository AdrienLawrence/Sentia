import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  parseJsonObject,
  readOptionalEnum,
  readOptionalLabel,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'

const NOTEBOOK_STYLES = [
  'blank',
  'standard',
  'composition',
  'grid'
] as const

// GET /api/notebooks - List notebooks for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(request)

    const notebooks = await prisma.notebook.findMany({
      where: {
        user_id: user.id
      },
      orderBy: {
        created_at: 'desc'
      },
      include: {
        _count: {
          select: {
            pages: true
          }
        }
      }
    })

    return NextResponse.json(notebooks)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch notebooks')
  }
}

// POST /api/notebooks - Create a notebook for the authenticated user
export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request)
    const user = await requireAuthenticatedUser(request)
    const body = await parseJsonObject(request, 16_384)
    assertAllowedKeys(body, ['name', 'style'])

    const name =
      readOptionalLabel(body, 'name', 100) ?? 'My Notebook'

    const style =
      readOptionalEnum(body, 'style', NOTEBOOK_STYLES) ?? 'blank'

    const notebookCount = await prisma.notebook.count({
      where: { user_id: user.id }
    })

    if (notebookCount >= 200) {
      throw new ApiRequestError('Notebook limit reached', 409)
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

    const notebook = await prisma.notebook.create({
      data: {
        name,
        style,
        user_id: user.id
      }
    })

    return NextResponse.json(notebook, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create notebook')
  }
}
