import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/notebooks - List notebooks
export async function GET(request: NextRequest) {
  try {
    // For now, return all notebooks until we implement proper auth
    const notebooks = await prisma.notebook.findMany({
      take: 4,
      orderBy: { created_at: 'desc' },
      include: {
        pages: {
          take: 1,
          orderBy: { created_at: 'desc' }
        }
      }
    })
    return NextResponse.json(notebooks)
  } catch (error) {
    console.error('Failed to fetch notebooks:', error)
    return NextResponse.json({ error: 'Failed to fetch notebooks' }, { status: 500 })
  }
}

// POST /api/notebooks - Create new notebook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // For now, let's get the first user from the database to associate with the notebook
    const firstUser = await prisma.user.findFirst()
    
    if (!firstUser) {
      return NextResponse.json({ error: 'No users found in database' }, { status: 400 })
    }
    
    console.log('Using user:', firstUser.id)
    
    // Create the notebook with the first user's ID
    const notebook = await prisma.notebook.create({
      data: {
        name: body.name || 'Untitled Notebook',
        style: body.style || 'blank',
        user_id: firstUser.id
      }
    })
    
    console.log('Created notebook:', notebook)
    return NextResponse.json(notebook)
  } catch (error) {
    console.error('Failed to create notebook:', error)
    return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 })
  }
}