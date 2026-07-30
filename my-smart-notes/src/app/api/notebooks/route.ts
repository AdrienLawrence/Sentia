import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { privateConditionalJson } from '@/lib/httpCache'

import {
  ApiRequestError,
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

    if (createInitialPage) {
      const created = await prisma.$transaction(async (tx) => {
        const notebook = await tx.notebook.create({
          data: {
            name,
            style,
            user_id: user.id,
            revision: 1
          }
        })
        const page = await tx.page.create({
          data: {
            title: 'Untitled Page',
            content: {
              type: 'doc',
              content: []
            },
            page_number: 1,
            user_id: user.id,
            notebook_id: notebook.id
          }
        })

        return { notebook, page }
      })

      return NextResponse.json(
        {
          ...created.notebook,
          latestPageId: created.page.id,
          initialPageId: created.page.id,
          _count: {
            pages: 1
          }
        },
        { status: 201 }
      )
    }

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
