import {
  createMcpHandler,
  hostHeaderValidationResponse,
  originValidationResponse
} from '@modelcontextprotocol/server'

import {
  authenticateMcpRequest,
  mcpAuthenticationResponse
} from '@/lib/mcp/auth'
import { createSentiaMcpServer } from '@/lib/mcp/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpHandler(
  ({ authInfo }) => createSentiaMcpServer(authInfo),
  { responseMode: 'json' }
)

function allowedHostnames() {
  const hostnames = new Set(['localhost', '127.0.0.1'])
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://sentia-nu.vercel.app'

  try {
    hostnames.add(new URL(configuredUrl).hostname)
  } catch {
    // Invalid public URLs fail later through OAuth resource metadata.
  }

  if (process.env.VERCEL_URL) {
    hostnames.add(process.env.VERCEL_URL.split(':')[0])
  }

  return [...hostnames]
}

async function serve(request: Request) {
  const hostError = hostHeaderValidationResponse(
    request,
    allowedHostnames()
  )
  if (hostError) return hostError

  const originError = originValidationResponse(
    request,
    allowedHostnames()
  )
  if (originError) return originError

  const contentLength = Number(
    request.headers.get('content-length') ?? '0'
  )

  if (!Number.isFinite(contentLength) || contentLength > 128_000) {
    return Response.json(
      { error: 'MCP request is too large' },
      { status: 413 }
    )
  }

  try {
    const authInfo = await authenticateMcpRequest(request)
    const response = await handler.fetch(request, { authInfo })
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    return response
  } catch (error) {
    return mcpAuthenticationResponse(request, error)
  }
}

export const GET = serve
export const POST = serve
export const DELETE = serve

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, DELETE, OPTIONS',
      'Cache-Control': 'no-store, max-age=0'
    }
  })
}
