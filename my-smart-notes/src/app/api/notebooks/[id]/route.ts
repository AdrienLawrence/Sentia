import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// GET /api/notebooks/[id] - Get single notebook with its pages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const notebook = await prisma.notebook.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { page_number: 'asc' },
          include: {
            draw_boxes: {
              include: { elements: true }
            }
          }
        }
      }
    })

    if (!notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
    }

    return NextResponse.json(notebook)
  } catch (error) {
    console.error('Failed to fetch notebook:', error)
    return NextResponse.json({ error: 'Failed to fetch notebook' }, { status: 500 })
  }
}

// PATCH /api/notebooks/[id] - Update notebook (rename, change style)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const notebook = await prisma.notebook.update({
      where: { id },
      data: {
        name: body.name,
        style: body.style
      }
    })

    return NextResponse.json(notebook)
  } catch (error) {
    console.error('Failed to update notebook:', error)
    return NextResponse.json({ error: 'Failed to update notebook' }, { status: 500 })
  }
}

// DELETE /api/notebooks/[id] - Delete notebook and its pages
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // This will cascade delete all pages due to onDelete: Cascade
    await prisma.notebook.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Notebook deleted' })
  } catch (error) {
    console.error('Failed to delete notebook:', error)
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 })
  }
}