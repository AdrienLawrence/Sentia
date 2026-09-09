import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { privateConditionalJson } from '@/lib/httpCache'
import { createNotebook, type NotebookStyle } from '@/lib/createNotebook'

import {
  apiErrorResponse,
  assertAllowedKeys,
  parseJsonObject,
  readOptionalBoolean,
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

    const notebooksWithLatestPage =
      await prisma.notebook.findMany({
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
        },
        pages: {
          orderBy: {
            updated_at: 'desc'
          },
          take: 1,
          select: {
            id: true
          }
        }
      }
    })
    const notebooks = notebooksWithLatestPage.map(
      ({ pages, ...notebook }) => ({
        ...notebook,
        latestPageId: pages?.[0]?.id ?? null
      })
    )

    return privateConditionalJson(
      request,
      notebooks,
      `${user.id}:notebooks`
    )
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
    assertAllowedKeys(body, ['name', 'style', 'createInitialPage'])

    const name =
      readOptionalLabel(body, 'name', 100) ?? 'My Notebook'

    const style =
      readOptionalEnum(body, 'style', NOTEBOOK_STYLES) ?? 'blank'
    const createInitialPage =
      readOptionalBoolean(body, 'createInitialPage') ?? false

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

    const created = await createNotebook({
      userId: user.id,
      name,
      style: style as NotebookStyle,
      createInitialPage
    })

    if (createInitialPage) {
      return NextResponse.json(
        {
          ...created.notebook,
          latestPageId: created.initialPageId,
          initialPageId: created.initialPageId,
          _count: {
            pages: 1
          }
        },
        { status: 201 }
      )
    }

    return NextResponse.json(created.notebook, { status: 201 })
  } catch (error) {
    return apiErrorResponse(error, 'Failed to create notebook')
  }
}
