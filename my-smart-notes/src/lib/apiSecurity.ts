import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'

import {
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION
} from '@/features/legal/constants'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_MAX_BODY_BYTES = 1_000_000
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/
const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype'
])
const LEGAL_CONSENT_CACHE_TTL_MS = 15 * 60 * 1000
const PENDING_LEGAL_CONSENT_CACHE_TTL_MS = 30 * 1000

interface SecurityRuntimeState {
  legalConsent: Map<
    string,
    {
      accepted: boolean
      expiresAt: number
    }
  >
  legalConsentRequests: Map<string, Promise<boolean>>
  readRateLimits: Map<
    string,
    {
      count: number
      windowStartedAt: number
    }
  >
}

const securityRuntimeKey = Symbol.for(
  'sentia.api-security-runtime'
)
const globalForSecurity = globalThis as typeof globalThis & {
  [securityRuntimeKey]?: SecurityRuntimeState
}
const securityRuntime =
  globalForSecurity[securityRuntimeKey] ??
  ({
    legalConsent: new Map(),
    legalConsentRequests: new Map(),
    readRateLimits: new Map()
  } satisfies SecurityRuntimeState)

globalForSecurity[securityRuntimeKey] = securityRuntime

export class ApiRequestError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(
    message: string,
    status = 400,
    retryAfterSeconds?: number
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

export async function enforcePublicRecoveryRateLimit(
  request: Request,
  normalizedEmail: string
) {
  const forwardedFor = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  const clientAddress =
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    forwardedFor ||
    'unknown'

  await Promise.all([
    consumePublicRateLimit(
      `public:recovery:client:${hashPublicRateLimitValue(clientAddress)}`,
      5,
      3600
    ),
    consumePublicRateLimit(
      `public:recovery:email:${hashPublicRateLimitValue(normalizedEmail)}`,
      3,
      3600
    )
  ])
}

async function consumePublicRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`
      INSERT INTO "api_rate_limits" ("key", "window_started_at", "count")
      VALUES (${key.slice(0, 200)}, CURRENT_TIMESTAMP, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "window_started_at" = CASE
          WHEN "api_rate_limits"."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
            THEN CURRENT_TIMESTAMP
          ELSE "api_rate_limits"."window_started_at"
        END,
        "count" = CASE
          WHEN "api_rate_limits"."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
            THEN 1
          ELSE LEAST("api_rate_limits"."count" + 1, ${limit + 1})
        END
      RETURNING "count"
    `
  )

  if ((rows[0]?.count ?? limit + 1) > limit) {
    console.warn('security.public_recovery_rate_limited')
    throw new ApiRequestError(
      'Too many recovery requests. Please try again later.',
      429,
      windowSeconds
    )
  }
}

function hashPublicRateLimitValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function requireAuthenticatedUser(
  request?: Request,
  options: {
    requireLegalConsent?: boolean
  } = {}
) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  const userId =
    typeof claims?.sub === 'string' ? claims.sub : null

  if (error || !userId || !UUID_PATTERN.test(userId)) {
    console.warn('security.auth_rejected')
    throw new ApiRequestError('Unauthorized', 401)
  }

  const user = {
    id: userId,
    email:
      typeof claims?.email === 'string' ? claims.email : null
  }

  const requestChecks: Array<Promise<void>> = []

  if (request) {
    requestChecks.push(enforceRateLimit(request, user.id))
  }

  if (options.requireLegalConsent !== false) {
    requestChecks.push(requireCurrentLegalConsent(user.id))
  }

  await Promise.all(requestChecks)

  return user
}

async function requireCurrentLegalConsent(userId: string) {
  const accepted = await hasCurrentLegalConsent(userId)

  if (!accepted) {
    console.warn('security.legal_consent_required', { userId })
    throw new ApiRequestError(
      'Current Privacy Policy and Terms of Service acceptance is required',
      451
    )
  }
}

function legalConsentCacheKey(userId: string) {
  return [
    userId,
    PRIVACY_POLICY_VERSION,
    TERMS_OF_SERVICE_VERSION
  ].join(':')
}

export async function hasCurrentLegalConsent(
  userId: string,
  options: {
    forceRefresh?: boolean
  } = {}
) {
  const cacheKey = legalConsentCacheKey(userId)
  const cached = securityRuntime.legalConsent.get(cacheKey)

  if (
    !options.forceRefresh &&
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.accepted
  }

  const existingRequest =
    securityRuntime.legalConsentRequests.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = Promise.resolve(
    prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        privacy_policy_version: true,
        privacy_policy_accepted_at: true,
        terms_of_service_version: true,
        terms_of_service_accepted_at: true
      }
    })
  )
    .then((storedUser) => {
      const accepted =
        storedUser?.privacy_policy_version ===
          PRIVACY_POLICY_VERSION &&
        storedUser.privacy_policy_accepted_at !== null &&
        storedUser?.terms_of_service_version ===
          TERMS_OF_SERVICE_VERSION &&
        storedUser.terms_of_service_accepted_at !== null

      rememberCurrentLegalConsent(userId, accepted)
      return accepted
    })
    .finally(() => {
      securityRuntime.legalConsentRequests.delete(cacheKey)
    })

  securityRuntime.legalConsentRequests.set(cacheKey, request)
  return request
}

export function rememberCurrentLegalConsent(
  userId: string,
  accepted: boolean
) {
  securityRuntime.legalConsent.set(
    legalConsentCacheKey(userId),
    {
      accepted,
      expiresAt:
        Date.now() +
        (accepted
          ? LEGAL_CONSENT_CACHE_TTL_MS
          : PENDING_LEGAL_CONSENT_CACHE_TTL_MS)
    }
  )
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin')

  if (!origin) {
    console.warn('security.origin_rejected', { reason: 'missing' })
    throw new ApiRequestError('Invalid request origin', 403)
  }

  let originUrl: URL

  try {
    originUrl = new URL(origin)
  } catch {
    throw new ApiRequestError('Invalid request origin', 403)
  }

  const expectedOrigin = new URL(request.url).origin

  if (originUrl.origin !== expectedOrigin) {
    console.warn('security.origin_rejected', { reason: 'mismatch' })
    throw new ApiRequestError('Invalid request origin', 403)
  }
}

export async function parseJsonObject(
  request: Request,
  maxBytes = DEFAULT_MAX_BODY_BYTES
) {
  const contentType = request.headers.get('content-type')

  if (!contentType?.toLowerCase().startsWith('application/json')) {
    throw new ApiRequestError('Content-Type must be application/json', 415)
  }

  const declaredLength = Number(
    request.headers.get('content-length') || 0
  )

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maxBytes
  ) {
    throw new ApiRequestError('Request body is too large', 413)
  }

  if (!request.body) {
    throw new ApiRequestError('Invalid JSON body')
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let actualLength = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    actualLength += value.byteLength

    if (actualLength > maxBytes) {
      await reader.cancel()
      throw new ApiRequestError('Request body is too large', 413)
    }

    chunks.push(value)
  }

  const bodyBytes = new Uint8Array(actualLength)
  let offset = 0

  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  let bodyText: string

  try {
    bodyText = new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes)
  } catch {
    throw new ApiRequestError('Invalid request encoding')
  }

  let body: unknown

  try {
    body = JSON.parse(bodyText)
  } catch {
    throw new ApiRequestError('Invalid JSON body')
  }

  if (!isRecord(body)) {
    throw new ApiRequestError('JSON body must be an object')
  }

  return body
}

export function assertAllowedKeys(
  body: Record<string, unknown>,
  allowedKeys: readonly string[]
) {
  const allowed = new Set(allowedKeys)
  const unexpectedKey = Object.keys(body).find(
    (key) => !allowed.has(key)
  )

  if (unexpectedKey) {
    throw new ApiRequestError(
      `Unexpected field: ${unexpectedKey}`
    )
  }
}

export function assertUuid(value: string, fieldName: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new ApiRequestError(`Invalid ${fieldName}`)
  }
}

export function assertUuidArray(
  value: unknown,
  fieldName: string,
  maxItems = 1000
) {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some(
      (item) =>
        typeof item !== 'string' ||
        !UUID_PATTERN.test(item)
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new ApiRequestError(`Invalid ${fieldName}`)
  }

  return value as string[]
}

export function readOptionalLabel(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
) {
  const value = body[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new ApiRequestError(`${key} must be a string`)
  }

  const sanitized = value
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()

  if (sanitized.length === 0 || sanitized.length > maxLength) {
    throw new ApiRequestError(
      `${key} must be between 1 and ${maxLength} characters`
    )
  }

  return sanitized
}

export function readOptionalText(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
  allowEmpty = false
) {
  const value = body[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new ApiRequestError(`${key} must be a string`)
  }

  const sanitized = value
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')

  if (
    (!allowEmpty && sanitized.trim().length === 0) ||
    sanitized.length > maxLength
  ) {
    throw new ApiRequestError(
      `${key} must be ${allowEmpty ? 'at most' : 'between 1 and'} ${maxLength} characters`
    )
  }

  return sanitized
}

export function readOptionalEnum<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[]
) {
  const value = body[key]

  if (value === undefined) {
    return undefined
  }

  if (
    typeof value !== 'string' ||
    !allowedValues.includes(value as T)
  ) {
    throw new ApiRequestError(`Invalid ${key}`)
  }

  return value as T
}

export function readRequiredNumber(
  body: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number
) {
  const value = body[key]

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new ApiRequestError(`Invalid ${key}`)
  }

  return value
}

export function readOptionalNumber(
  body: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number
) {
  if (body[key] === undefined) {
    return undefined
  }

  return readRequiredNumber(body, key, minimum, maximum)
}

export function readOptionalBoolean(
  body: Record<string, unknown>,
  key: string
) {
  const value = body[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'boolean') {
    throw new ApiRequestError(`${key} must be a boolean`)
  }

  return value
}

export function validateStructuredJson(
  value: unknown,
  options: {
    maxDepth?: number
    maxNodes?: number
    maxTextLength?: number
  } = {}
) {
  const maxDepth = options.maxDepth ?? 30
  const maxNodes = options.maxNodes ?? 20_000
  const maxTextLength = options.maxTextLength ?? 500_000
  let nodes = 0
  let textLength = 0

  const visit = (current: unknown, depth: number) => {
    if (depth > maxDepth) {
      throw new ApiRequestError('Document is too deeply nested')
    }

    nodes += 1

    if (nodes > maxNodes) {
      throw new ApiRequestError('Document contains too many nodes')
    }

    if (
      current === null ||
      typeof current === 'boolean' ||
      typeof current === 'number'
    ) {
      return
    }

    if (typeof current === 'string') {
      textLength += current.length

      if (textLength > maxTextLength) {
        throw new ApiRequestError('Document text is too long')
      }

      return
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1))
      return
    }

    if (!isRecord(current)) {
      throw new ApiRequestError('Document contains an invalid value')
    }

    for (const [key, child] of Object.entries(current)) {
      if (
        FORBIDDEN_KEYS.has(key) ||
        !SAFE_KEY_PATTERN.test(key) ||
        key.toLowerCase().startsWith('on')
      ) {
        throw new ApiRequestError('Document contains an unsafe field')
      }

      if (
        (key === 'href' || key === 'src') &&
        typeof child === 'string' &&
        !isSafeResourceUrl(child)
      ) {
        throw new ApiRequestError('Document contains an unsafe URL')
      }

      visit(child, depth + 1)
    }
  }

  visit(value, 0)

  return value
}

export function validateTiptapDocument(value: unknown) {
  if (!isRecord(value) || value.type !== 'doc') {
    throw new ApiRequestError('Invalid page content')
  }

  validateStructuredJson(value)
  return value
}

export function validateProperties(value: unknown) {
  if (!isRecord(value)) {
    throw new ApiRequestError('properties must be an object')
  }

  validateStructuredJson(value, {
    maxDepth: 8,
    maxNodes: 500,
    maxTextLength: 10_000
  })

  return value
}

export function apiErrorResponse(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof ApiRequestError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: error.retryAfterSeconds
          ? { 'Retry-After': String(error.retryAfterSeconds) }
          : undefined
      }
    )
  }

  console.error(
    fallbackMessage,
    error instanceof Error ? error.name : 'UnknownError'
  )

  Sentry.captureException(error, {
    tags: { component: 'api' },
    extra: { operation: fallbackMessage }
  })

  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500 }
  )
}

function isSafeResourceUrl(value: string) {
  if (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('mailto:')
  ) {
    return true
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

async function enforceRateLimit(request: Request, userId: string) {
  const url = new URL(request.url)
  const route = url.pathname.replace(
    /\/[0-9a-f]{8}-[0-9a-f-]{27,35}(?=\/|$)/gi,
    '/:id'
  )
  const method = request.method.toUpperCase()
  const { limit, windowSeconds } = getRateLimit(method, route)
  const key = `${userId}:${method}:${route}`.slice(0, 200)

  if (method === 'GET') {
    enforceReadRateLimit(key, limit, windowSeconds)
    return
  }

  const rows = await prisma.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`
      INSERT INTO "api_rate_limits" ("key", "window_started_at", "count")
      VALUES (${key}, CURRENT_TIMESTAMP, 1)
      ON CONFLICT ("key") DO UPDATE SET
        "window_started_at" = CASE
          WHEN "api_rate_limits"."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
            THEN CURRENT_TIMESTAMP
          ELSE "api_rate_limits"."window_started_at"
        END,
        "count" = CASE
          WHEN "api_rate_limits"."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
            THEN 1
          ELSE LEAST("api_rate_limits"."count" + 1, ${limit + 1})
        END
      RETURNING "count"
    `
  )

  if ((rows[0]?.count ?? limit + 1) > limit) {
    console.warn('security.rate_limited', { method, route, userId })
    throw new ApiRequestError(
      'Too many requests',
      429,
      windowSeconds
    )
  }

  if (
    method === 'POST' &&
    (route === '/api/ai/ask' || route === '/api/ai/quiz')
  ) {
    await enforceDailyAiLimit(userId, route)
  }
}

export async function enforceAuthenticatedRateLimit(
  request: Request,
  userId: string
) {
  await enforceRateLimit(request, userId)
}

function enforceReadRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
) {
  const now = Date.now()
  const windowMilliseconds = windowSeconds * 1000
  const current = securityRuntime.readRateLimits.get(key)

  if (
    !current ||
    current.windowStartedAt <= now - windowMilliseconds
  ) {
    securityRuntime.readRateLimits.set(key, {
      count: 1,
      windowStartedAt: now
    })
    return
  }

  current.count += 1

  if (current.count > limit) {
    console.warn('security.rate_limited', {
      method: 'GET',
      route: key.slice(key.indexOf(':GET:') + 5),
      userId: key.slice(0, key.indexOf(':GET:'))
    })
    throw new ApiRequestError(
      'Too many requests',
      429,
      Math.max(
        1,
        Math.ceil(
          (current.windowStartedAt +
            windowMilliseconds -
            now) /
            1000
        )
      )
    )
  }

  if (securityRuntime.readRateLimits.size > 5000) {
    for (const [storedKey, entry] of securityRuntime.readRateLimits) {
      if (
        entry.windowStartedAt <=
        now - windowMilliseconds
      ) {
        securityRuntime.readRateLimits.delete(storedKey)
      }
    }
  }
}

async function enforceDailyAiLimit(
  userId: string,
  route: string
) {
  const limit = 30
  const windowSeconds = 86_400
  const cost = route === '/api/ai/quiz' ? 5 : 1
  const key = `${userId}:AI:daily`.slice(0, 200)
  const rows = await prisma.$queryRaw<
    Array<{ count: number; retry_after_seconds: number }>
  >(
    Prisma.sql`
      INSERT INTO "api_rate_limits" ("key", "window_started_at", "count")
      VALUES (${key}, CURRENT_TIMESTAMP, ${cost})
      ON CONFLICT ("key") DO UPDATE SET
        "window_started_at" = CASE
          WHEN "api_rate_limits"."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
            THEN CURRENT_TIMESTAMP
          ELSE "api_rate_limits"."window_started_at"
        END,
        "count" = CASE
          WHEN "api_rate_limits"."window_started_at" <= CURRENT_TIMESTAMP - (${windowSeconds} * INTERVAL '1 second')
            THEN ${cost}
          ELSE LEAST("api_rate_limits"."count" + ${cost}, ${limit + cost})
        END
      RETURNING
        "count",
        GREATEST(
          1,
          CEIL(
            EXTRACT(
              EPOCH FROM (
                "window_started_at" + (${windowSeconds} * INTERVAL '1 second') - CURRENT_TIMESTAMP
              )
            )
          )::integer
        ) AS "retry_after_seconds"
    `
  )
  const usage = rows[0]

  if (!usage || usage.count > limit) {
    console.warn('security.ai_daily_limit_reached', {
      userId,
      route
    })
    throw new ApiRequestError(
      'Daily AI limit reached. Try again after your allowance resets.',
      429,
      usage?.retry_after_seconds ?? windowSeconds
    )
  }
}

function getRateLimit(method: string, route: string) {
  if (method === 'POST' && route === '/api/mcp') {
    return { limit: 120, windowSeconds: 60 }
  }

  if (method === 'POST' && route.startsWith('/api/ai/')) {
    return { limit: 20, windowSeconds: 60 }
  }

  if (method === 'POST' && route === '/api/feedback') {
    return { limit: 5, windowSeconds: 3600 }
  }

  if (method === 'POST' && route === '/api/notebooks') {
    return { limit: 20, windowSeconds: 3600 }
  }

  if (method === 'POST' && route.endsWith('/pages')) {
    return { limit: 120, windowSeconds: 3600 }
  }

  if (route.startsWith('/api/draw-')) {
    return { limit: 300, windowSeconds: 3600 }
  }

  if (method === 'DELETE') {
    return { limit: 30, windowSeconds: 60 }
  }

  return {
    limit: method === 'GET' ? 180 : 240,
    windowSeconds: 60
  }
}
