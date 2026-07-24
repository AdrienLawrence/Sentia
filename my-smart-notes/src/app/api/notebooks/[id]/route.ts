import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import {
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
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

// GET /api/notebooks/[id] - Get one notebook
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
      include: {
        _count: {
          select: {
            pages: true
          }
        }
      }
    })

    if (!notebook) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(notebook)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch notebook')
  }
}

// PATCH /api/notebooks/[id] - Update notebook metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireSameOrigin(request)
    const { id: notebookId } = await params
    assertUuid(notebookId, 'notebook ID')
    const user = await requireAuthenticatedUser(request)
    const body = await parseJsonObject(request, 16_384)
    assertAllowedKeys(body, ['name', 'style', 'markOpened'])

    const data: {
      name?: string
      style?: string
      last_opened_at?: Date
    } = {}

    if (body.name !== undefined) {
      data.name = readOptionalLabel(body, 'name', 100)
    }

    if (body.style !== undefined) {
      data.style = readOptionalEnum(
        body,
        'style',
        NOTEBOOK_STYLES
      )
    }

    if (readOptionalBoolean(body, 'markOpened')) {
      data.last_opened_at = new Date()
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 }
      )
    }

    const existingNotebook =
      await prisma.notebook.findFirst({
        where: {
          id: notebookId,
          user_id: user.id
        },
        select: {
          id: true
        }
      })

    if (!existingNotebook) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 }
      )
    }

    const notebook = await prisma.notebook.update({
      where: {
        id: notebookId
      },
      data
    })

    return NextResponse.json(notebook)
  } catch (error) {
    return apiErrorResponse(error, 'Failed to update notebook')
  }
}

// DELETE /api/notebooks/[id] - Delete notebook and all related data
export async function DELETE(
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

    await prisma.notebook.delete({
      where: {
        id: notebookId
      }
    })

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    return apiErrorResponse(error, 'Failed to delete notebook')
  }
}
