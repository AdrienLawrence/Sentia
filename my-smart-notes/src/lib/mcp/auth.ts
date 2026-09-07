import type { AuthInfo } from '@modelcontextprotocol/server'

import {
  ApiRequestError,
  enforceAuthenticatedRateLimit,
  hasCurrentLegalConsent
} from '@/lib/apiSecurity'

const MAX_ACCESS_TOKEN_LENGTH = 16_384

type JwtPayload = {
  sub?: unknown
  exp?: unknown
  client_id?: unknown
  scope?: unknown
  scopes?: unknown
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.')

  if (parts.length !== 3) {
    throw new ApiRequestError('Invalid access token', 401)
  }

  try {
    return JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8')
    ) as JwtPayload
  } catch {
    throw new ApiRequestError('Invalid access token', 401)
  }
}

function allowedClientIds() {
  return new Set(
    (process.env.SENTIA_MCP_ALLOWED_CLIENT_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )
}

function tokenScopes(payload: JwtPayload) {
  if (typeof payload.scope === 'string') {
    return payload.scope.split(/\s+/).filter(Boolean)
  }

  if (Array.isArray(payload.scopes)) {
    return payload.scopes.filter(
      (scope): scope is string => typeof scope === 'string'
    )
  }

  return []
}

export async function authenticateMcpRequest(
  request: Request,
  fetchImplementation: typeof fetch = fetch
): Promise<AuthInfo> {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw new ApiRequestError('Bearer token required', 401)
  }

  const token = authorization.slice('Bearer '.length).trim()

  if (!token || token.length > MAX_ACCESS_TOKEN_LENGTH) {
    throw new ApiRequestError('Invalid access token', 401)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new ApiRequestError(
      'MCP authentication is not configured',
      503
    )
  }

  const configuredClientIds = allowedClientIds()

  if (configuredClientIds.size === 0) {
    throw new ApiRequestError('MCP access is not enabled', 503)
  }

  const payload = decodeJwtPayload(token)
  const clientId =
    typeof payload.client_id === 'string'
      ? payload.client_id
      : null
  const expiresAt =
    typeof payload.exp === 'number' ? payload.exp : null

  if (
    !clientId ||
    !configuredClientIds.has(clientId) ||
    !expiresAt ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
    throw new ApiRequestError('Invalid access token', 401)
  }

  let response: Response

  try {
    response = await fetchImplementation(
      `${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`
        },
        signal: AbortSignal.timeout(8_000),
        cache: 'no-store'
      }
    )
  } catch {
    throw new ApiRequestError(
      'Authentication service unavailable',
      503
    )
  }

  if (!response.ok) {
    throw new ApiRequestError('Invalid access token', 401)
  }

  const authenticatedUser = (await response.json()) as {
    id?: unknown
  }
  const userId =
    typeof authenticatedUser.id === 'string'
      ? authenticatedUser.id
      : null

  if (!userId || payload.sub !== userId) {
    throw new ApiRequestError('Invalid access token', 401)
  }

  if (!(await hasCurrentLegalConsent(userId))) {
    throw new ApiRequestError(
      'Current Sentia legal acceptance is required',
      403
    )
  }

  await enforceAuthenticatedRateLimit(request, userId)

  return {
    token,
    clientId,
    scopes: tokenScopes(payload),
    expiresAt,
    extra: { userId }
  }
}

export function mcpAuthenticationResponse(
  request: Request,
  error: unknown
) {
  const status =
    error instanceof ApiRequestError ? error.status : 500
  const message =
    status === 503
      ? error instanceof Error
        ? error.message
        : 'MCP is unavailable'
      : status === 403
        ? error instanceof Error
          ? error.message
          : 'Access denied'
        : 'Unauthorized'
  const metadataUrl = new URL(
    '/.well-known/oauth-protected-resource/api/mcp',
    request.url
  )
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json; charset=utf-8'
  }

  if (status === 401 || status === 403) {
    headers['WWW-Authenticate'] =
      `Bearer resource_metadata="${metadataUrl.toString()}"`
  }

  if (
    error instanceof ApiRequestError &&
    error.retryAfterSeconds !== undefined
  ) {
    headers['Retry-After'] = String(error.retryAfterSeconds)
  }

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers
  })
}
