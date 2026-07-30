import { prisma } from '@/lib/prisma'
import { privateConditionalJson } from '@/lib/httpCache'
import {
  apiErrorResponse,
  assertUuid,
  requireAuthenticatedUser
} from '@/lib/apiSecurity'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: notebookId } = await params
    assertUuid(notebookId, 'notebook ID')
    const user = await requireAuthenticatedUser(request)

    const latestPage = await prisma.page.findFirst({
      where: {
        notebook_id: notebookId,
        user_id: user.id
      },
      orderBy: { updated_at: 'desc' },
      select: {
        id: true
      }
    })
    
    return privateConditionalJson(
      request,
      latestPage,
      `${user.id}:notebook:${notebookId}:latest-page`
    )
  } catch (error) {
    return apiErrorResponse(error, 'Failed to fetch latest page')
  }
}
