import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

const PRIVATE_REVALIDATION_HEADERS = {
  'Cache-Control':
    'private, no-cache, max-age=0, must-revalidate',
  Vary: 'Cookie'
} as const

export function privateConditionalJson(
  request: Request,
  data: unknown,
  cacheScope: string
) {
  const serialized = JSON.stringify(data)
  const digest = createHash('sha256')
    .update(cacheScope)
    .update('\0')
    .update(serialized)
    .digest('base64url')
  const etag = `"${digest}"`
  const responseHeaders = {
    ...PRIVATE_REVALIDATION_HEADERS,
    ETag: etag
  }

  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: responseHeaders
    })
  }

  return new NextResponse(serialized, {
    status: 200,
    headers: {
      ...responseHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}

function etagMatches(headerValue: string | null, etag: string) {
  if (!headerValue) return false

  return headerValue.split(',').some((candidate) => {
    const normalized = candidate.trim().replace(/^W\//, '')
    return normalized === '*' || normalized === etag
  })
}
