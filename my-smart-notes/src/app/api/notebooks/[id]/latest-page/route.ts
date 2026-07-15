import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const latestPage = await prisma.page.findFirst({
      where: { notebook_id: params.id },
      orderBy: { updated_at: 'desc' }
    })
    
    return NextResponse.json(latestPage)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch latest page' }, { status: 500 })
  }
}