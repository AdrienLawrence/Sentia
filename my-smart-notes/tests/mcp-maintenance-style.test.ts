import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { NextRequest } from 'next/server'

import { POST as mcpPost } from '../src/app/api/mcp/route.ts'
import { markdownToTiptapDocument } from '../src/features/file-transfer/lib/content.ts'
import { tiptapDocumentToMarkdown } from '../src/features/file-transfer/lib/markdown.ts'
import { deriveWritingStyle } from '../src/lib/ai/writingStyle.ts'
import { isSafeOAuthRedirect } from '../src/features/integrations/lib/oauthRedirect.ts'
import {
  legalAcceptancePath,
  safeLegalReturnPath
} from '../src/features/legal/navigation.ts'
import { authenticateMcpRequest } from '../src/lib/mcp/auth.ts'
import {
  isMaintenanceExemptPath,
  isMaintenanceModeEnabled,
  maintenanceResponse
} from '../src/lib/maintenance.ts'
import {
  sanitizeSentryEvent,
  sanitizeSentryTransaction
} from '../src/lib/monitoring/sentryPrivacy.ts'
import { resetTestState, testState } from './mocks/state.ts'
import { USER_ID } from './helpers.ts'

const originalEnvironment = {
  allowedClients: process.env.SENTIA_MCP_ALLOWED_CLIENT_IDS,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  maintenance: process.env.MAINTENANCE_MODE,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
}

function restoreEnvironment(
  key: keyof NodeJS.ProcessEnv,
  value: string | undefined
) {
  if (value === undefined) {
    delete process.env[key]
  } else {
    process.env[key] = value
  }
}

function accessToken(clientId = 'codex-client') {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')

  return [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      sub: USER_ID,
      client_id: clientId,
      exp: Math.floor(Date.now() / 1000) + 3600,
      scope: 'openid email profile'
    }),
    'test-signature'
  ].join('.')
}

function authenticatedRequest(body: unknown) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      Host: 'localhost'
    },
    body: JSON.stringify(body)
  })
}

async function mcpPayload(response: Response) {
  const body = await response.text()

  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    return JSON.parse(body) as unknown
  }

  const dataLine = body
    .split(/\r?\n/)
    .find((line) => line.startsWith('data: '))

  assert.ok(dataLine, 'Expected an MCP SSE data event')
  return JSON.parse(dataLine.slice('data: '.length)) as unknown
}

beforeEach(() => {
  resetTestState()
  process.env.SENTIA_MCP_ALLOWED_CLIENT_IDS = 'codex-client'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})

afterEach(() => {
  restoreEnvironment(
    'SENTIA_MCP_ALLOWED_CLIENT_IDS',
    originalEnvironment.allowedClients
  )
  restoreEnvironment(
    'NEXT_PUBLIC_SUPABASE_URL',
    originalEnvironment.supabaseUrl
  )
  restoreEnvironment(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    originalEnvironment.anonKey
  )
  restoreEnvironment(
    'MAINTENANCE_MODE',
    originalEnvironment.maintenance
  )
})

describe('Sentia MCP authentication and protocol', () => {
  test('accepts secure and loopback OAuth callbacks only', () => {
    assert.equal(
      isSafeOAuthRedirect(
        'http://127.0.0.1/callback/2LCvYlVC4AOD?code=test'
      ),
      true
    )
    assert.equal(
      isSafeOAuthRedirect('http://localhost/callback'),
      true
    )
    assert.equal(
      isSafeOAuthRedirect('https://client.example/callback'),
      true
    )
    assert.equal(
      isSafeOAuthRedirect('http://client.example/callback'),
      false
    )
  })

  test('requires an allowlisted OAuth client and validated Supabase user', async () => {
    const token = accessToken()
    const auth = await authenticateMcpRequest(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }),
      async (_input, init) => {
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          `Bearer ${token}`
        )
        return Response.json({ id: USER_ID })
      }
    )

    assert.equal(auth.clientId, 'codex-client')
    assert.equal(auth.extra?.userId, USER_ID)
    assert.equal(auth.token, token)
  })

  test('rejects cookie-only and unallowlisted clients', async () => {
    await assert.rejects(
      authenticateMcpRequest(
        new Request('http://localhost/api/mcp'),
        async () => Response.json({ id: USER_ID })
      ),
      /Bearer token required/
    )

    await assert.rejects(
      authenticateMcpRequest(
        new Request('http://localhost/api/mcp', {
          headers: {
            Authorization: `Bearer ${accessToken('unknown-client')}`
          }
        }),
        async () => Response.json({ id: USER_ID })
      ),
      /Invalid access token/
    )
  })

  test('serves the constrained tool list over stateless MCP', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => Response.json({ id: USER_ID })

    try {
      const response = await mcpPost(
        authenticatedRequest({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      )
      const payload = (await mcpPayload(response)) as {
        result?: { tools?: Array<{ name: string }> }
      }

      assert.equal(response.status, 200)
      assert.deepEqual(
        payload.result?.tools?.map((tool) => tool.name),
        [
          'list_notebooks',
          'list_pages',
          'read_page',
          'create_page',
          'append_to_page',
          'update_page'
        ]
      )
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  test('scopes notebook listing to the authenticated user', async () => {
    const previousFetch = globalThis.fetch
    globalThis.fetch = async () => Response.json({ id: USER_ID })
    testState.prisma['notebook.findMany'] = (args) => {
      assert.deepEqual(args.where, { user_id: USER_ID })
      return []
    }

    try {
      const response = await mcpPost(
        authenticatedRequest({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'list_notebooks',
            arguments: {}
          }
        })
      )

      assert.equal(response.status, 200)
      assert.equal(
        testState.calls.prisma.some(
          (call) => call.method === 'notebook.findMany'
        ),
        true
      )
    } finally {
      globalThis.fetch = previousFetch
    }
  })

  test('replaces only an owned page after claiming its revision', async () => {
    const previousFetch = globalThis.fetch
    const pageId = '22222222-2222-4222-8222-222222222222'
    const notebookId = '33333333-3333-4333-8333-333333333333'
    globalThis.fetch = async () => Response.json({ id: USER_ID })
    testState.prisma['page.findFirst'] = (args) => {
      assert.deepEqual(args.where, { id: pageId, user_id: USER_ID })
      return { id: pageId, notebook_id: notebookId }
    }
    testState.prisma['notebook.updateMany'] = (args) => {
      assert.deepEqual(args.where, {
        id: notebookId,
        user_id: USER_ID,
        revision: 4
      })
      return { count: 1 }
    }
    testState.prisma['page.update'] = (args) => {
      assert.equal(args.where.id, pageId)
      assert.equal(args.data.title, 'Reformatted')
      assert.equal(args.data.content.type, 'doc')
      return {
        id: pageId,
        title: 'Reformatted',
        updated_at: new Date()
      }
    }

    try {
      const response = await mcpPost(
        authenticatedRequest({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: {
            name: 'update_page',
            arguments: {
              pageId,
              expectedRevision: 4,
              title: 'Reformatted',
              markdown: 'Use **clear formatting**.'
            }
          }
        })
      )
      const payload = (await mcpPayload(response)) as {
        result?: { isError?: boolean }
      }

      assert.equal(response.status, 200)
      assert.notEqual(payload.result?.isError, true)
      assert.equal(
        testState.calls.prisma.some(
          (call) => call.method === 'page.update'
        ),
        true
      )
    } finally {
      globalThis.fetch = previousFetch
    }
  })
})

describe('Sentry privacy boundary', () => {
  test('removes credentials, query strings, and URL fragments from errors', () => {
    const event = sanitizeSentryEvent({
      type: undefined,
      user: { id: 'private-user' },
      request: {
        url: 'https://sentia.example/auth/callback?code=secret#fragment',
        query_string: 'code=secret',
        cookies: { session: 'secret' },
        headers: {
          authorization: 'Bearer secret',
          accept: 'application/json'
        }
      },
      breadcrumbs: [
        {
          data: {
            from: '/login?next=secret',
            url: 'https://sentia.example/auth/confirm?token_hash=secret'
          }
        }
      ]
    })

    assert.equal(event.user, undefined)
    assert.equal(event.request?.url, 'https://sentia.example/auth/callback')
    assert.equal(event.request?.query_string, undefined)
    assert.equal(event.request?.cookies, undefined)
    assert.equal(event.request?.headers?.authorization, undefined)
    assert.equal(event.request?.headers?.accept, 'application/json')
    assert.equal(event.breadcrumbs?.[0]?.data?.from, '/login')
    assert.equal(
      event.breadcrumbs?.[0]?.data?.url,
      'https://sentia.example/auth/confirm'
    )
  })

  test('removes URL query data from tracing transactions and spans', () => {
    const event = sanitizeSentryTransaction({
      type: 'transaction',
      transaction: '/oauth/consent?authorization_id=secret',
      request: {
        url: 'https://sentia.example/oauth/consent?authorization_id=secret',
        query_string: { authorization_id: 'secret' }
      },
      spans: [
        {
          data: {
            url: 'https://api.example/resource?token=secret',
            'http.query': 'token=secret'
          },
          span_id: '1234567890abcdef',
          trace_id: '1234567890abcdef1234567890abcdef',
          start_timestamp: 1
        }
      ]
    })

    assert.equal(event.transaction, '/oauth/consent')
    assert.equal(event.request?.url, 'https://sentia.example/oauth/consent')
    assert.equal(event.request?.query_string, undefined)
    assert.equal(
      event.spans?.[0]?.data.url,
      'https://api.example/resource'
    )
    assert.equal(event.spans?.[0]?.data['http.query'], undefined)
  })
})

describe('maintenance mode', () => {
  test('recognizes explicit enable values and keeps health available', () => {
    process.env.MAINTENANCE_MODE = 'true'
    assert.equal(isMaintenanceModeEnabled(), true)
    assert.equal(isMaintenanceExemptPath('/api/health'), true)
    assert.equal(isMaintenanceExemptPath('/api/notebooks'), false)

    process.env.MAINTENANCE_MODE = 'false'
    assert.equal(isMaintenanceModeEnabled(), false)
  })

  test('returns 503 HTML for pages and 503 JSON for APIs', async () => {
    const pageResponse = maintenanceResponse(
      new NextRequest('http://localhost/dashboard')
    )
    const apiResponse = maintenanceResponse(
      new NextRequest('http://localhost/api/notebooks')
    )

    assert.equal(pageResponse.status, 503)
    assert.equal(pageResponse.headers.get('retry-after'), '300')
    assert.match(await pageResponse.text(), /Sentia will be back shortly/)
    assert.equal(apiResponse.status, 503)
    assert.equal(
      (await apiResponse.json()).error,
      'Sentia is temporarily unavailable for maintenance.'
    )
  })
})

describe('legal acceptance navigation', () => {
  test('preserves protected Sentia destinations', () => {
    assert.equal(
      safeLegalReturnPath('/editor/abc?mode=read'),
      '/editor/abc?mode=read'
    )
    assert.equal(
      legalAcceptancePath('/quiz/notebook-id'),
      '/legal/accept?next=%2Fquiz%2Fnotebook-id'
    )
  })

  test('rejects external and unrelated return destinations', () => {
    assert.equal(safeLegalReturnPath('//example.com'), '/dashboard')
    assert.equal(safeLegalReturnPath('/oauth/consent'), '/dashboard')
    assert.equal(
      safeLegalReturnPath('/dashboard\\example.com'),
      '/dashboard'
    )
  })
})

describe('formatted Markdown and writing style', () => {
  test('imports common inline formatting used by MCP writes', () => {
    const document = markdownToTiptapDocument(
      '# Topic\n\nUse **bold**, *italic*, ~~removed~~, and `code`.'
    )
    const markdown = tiptapDocumentToMarkdown(document)

    assert.match(markdown, /\*\*bold\*\*/)
    assert.match(markdown, /\*italic\*/)
    assert.match(markdown, /~~removed~~/)
    assert.match(markdown, /`code`/)
  })

  test('derives a compact style description without copying note text', () => {
    const privateSentence =
      "I don't want this private sentence copied into a profile."
    const document = markdownToTiptapDocument(
      Array.from({ length: 8 }, (_, index) =>
        `- ${privateSentence} Item ${index + 1}. Keep it direct.`
      ).join('\n')
    )
    const style = deriveWritingStyle(document)

    assert.ok(style)
    assert.match(style, /sentences|paragraphs|lists/)
    assert.doesNotMatch(style, /private sentence/i)
  })

  test('does not invent a style profile from a short note', () => {
    assert.equal(
      deriveWritingStyle(markdownToTiptapDocument('Short note.')),
      null
    )
  })
})
