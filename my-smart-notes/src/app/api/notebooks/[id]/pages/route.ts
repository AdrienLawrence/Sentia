import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/notebooks/[id]/pages - Get all pages for a notebook
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notebookId } = await params
    
    console.log('Fetching pages for notebook:', notebookId)
    
    const pages = await prisma.page.findMany({
      where: { notebook_id: notebookId },
      orderBy: { page_number: 'asc' },
      include: {
        notebook: true
      }
    })
    
    console.log('Found pages:', pages.length)
    return NextResponse.json(pages)
  } catch (error) {
    console.error('Failed to fetch pages:', error)
    return NextResponse.json([], { status: 200 }) // Return empty array instead of error
  }
}

// POST /api/notebooks/[id]/pages - Create new page
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notebookId } = await params
    const body = await request.json()

    console.log('Creating page for notebook:', notebookId)

    // Get the first user from the database to associate with the page
    const firstUser = await prisma.user.findFirst()
    
    if (!firstUser) {
      console.error('No users found in database')
      return NextResponse.json({ error: 'No users found in database' }, { status: 400 })
    }

    console.log('Using user:', firstUser.id)

    // Get the highest page number for this notebook to determine the next page number
    const lastPage = await prisma.page.findFirst({
      where: { notebook_id: notebookId },
      orderBy: { page_number: 'desc' }
    })

    const nextPageNumber = (lastPage?.page_number || 0) + 1
    console.log('Next page number:', nextPageNumber)

    const page = await prisma.page.create({
      data: {
        title: body.title || 'Untitled Page',
        content: body.content || { type: 'doc', content: [] },
        page_number: nextPageNumber,
        user_id: firstUser.id,
        notebook_id: notebookId
      }
    })

    console.log('Created page:', page)
    return NextResponse.json(page)
  } catch (error) {
    console.error('Failed to create page:', error)
    return NextResponse.json({ error: 'Failed to create page' }, { status: 500 })
  }
}