import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// GET /api/pages/[id] - Get single page with all content
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const page = await prisma.page.findUnique({
      where: { id },
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
    console.error('Failed to fetch page:', error)
    return NextResponse.json({ error: 'Failed to fetch page' }, { status: 500 })
  }
}

// PATCH /api/pages/[id] - Update page content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const page = await prisma.page.update({
      where: { id },
      data: {
        content: body.content,
        title: body.title,
        updated_at: new Date()
      }
    })

    return NextResponse.json(page)
  } catch (error) {
    console.error('Failed to update page:', error)
    return NextResponse.json({ error: 'Failed to update page' }, { status: 500 })
  }
}

// DELETE /api/pages/[id] - Delete page
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.page.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Page deleted' })
  } catch (error) {
    console.error('Failed to delete page:', error)
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 })
  }
}