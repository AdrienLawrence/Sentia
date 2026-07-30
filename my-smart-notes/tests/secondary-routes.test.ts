import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import { POST as createDrawBox } from '../src/app/api/draw-boxes/route.ts'
import {
  POST as createDrawElement
} from '../src/app/api/draw-elements/route.ts'
import {
  DELETE as deleteDrawElement,
  GET as getDrawElement,
  PATCH as updateDrawElement
} from '../src/app/api/draw-elements/[id]/route.ts'
import {
  GET as getFeedback,
  POST as submitFeedback
} from '../src/app/api/feedback/route.ts'
import {
  GET as getLegalConsent,
  POST as acceptLegalDocuments
} from '../src/app/api/legal-consent/route.ts'
import { GET as getHealth } from '../src/app/api/health/route.ts'
import {
  GET as getLatestPage
} from '../src/app/api/notebooks/[id]/latest-page/route.ts'
import {
  PRIVACY_POLICY_VERSION,
  TERMS_OF_SERVICE_VERSION
} from '../src/features/legal/constants.ts'
import {
  resetTestState,
  testState
} from './mocks/state.ts'
import {
  NOTEBOOK_ID,
  PAGE_ID,
  USER_ID,
  jsonRequest,
  responseJson
} from './helpers.ts'

const DRAW_BOX_ID =
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const DRAW_ELEMENT_ID =
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

beforeEach(resetTestState)

describe('deployment health route', () => {
  test('reports readiness without exposing secret values', async () => {
    const environment = {
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY:
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY
    }

    process.env.DATABASE_URL = 'postgresql://secret'
    process.env.NEXT_PUBLIC_SUPABASE_URL =
      'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'secret-anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-service-role'
    process.env.OPENAI_API_KEY = 'secret-openai'

    try {
      const response = await getHealth()
      const body = await response.text()

      assert.equal(response.status, 200)
      assert.match(body, /"status":"ok"/)
      assert.equal(body.includes('secret-openai'), false)
      assert.equal(body.includes('secret-anon'), false)
      assert.equal(body.includes('secret-service-role'), false)
      assert.match(
        response.headers.get('cache-control') ?? '',
        /no-store/
      )
    } finally {
      for (const [name, value] of Object.entries(environment)) {
        if (value === undefined) {
          delete process.env[name]
        } else {
          process.env[name] = value
        }
      }
    }
  })
})

describe('feedback routes', () => {
  test('stores optional diagnostic context only when selected', async () => {
    testState.prisma['user.upsert'] = () => ({ id: USER_ID })
    let createData: Record<string, any> | undefined
    testState.prisma['feedback.create'] = ({ data }) => {
      createData = data
      return { id: 'feedback-1', ...data }
    }

    const response = await submitFeedback(
      new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost',
          'Content-Type': 'application/json',
          'User-Agent': 'Sentia Test Browser'
        },
        body: JSON.stringify({
          category: 'bug',
          message: 'The editor did not save this page.',
          contactAllowed: true,
          includeContext: true,
          pagePath: '/editor/test'
        })
      }) as any
    )

    assert.equal(response.status, 201)
    assert.equal(createData?.user_id, USER_ID)
    assert.equal(createData?.contact_allowed, true)
    assert.deepEqual(createData?.context, {
      pagePath: '/editor/test',
      userAgent: 'Sentia Test Browser'
    })
  })

  test('scopes feedback history to the authenticated user', async () => {
    testState.prisma['feedback.findMany'] = ({ where }) => {
      assert.deepEqual(where, { user_id: USER_ID })
      return []
    }

    const response = await getFeedback(
      new Request('http://localhost/api/feedback') as any
    )

    assert.equal(response.status, 200)
  })
})

describe('legal consent routes', () => {
  test('does not allow a deleted account token to recreate the user', async () => {
    testState.prisma['deletedAccountTombstone.findUnique'] = () => ({
      expires_at: new Date(Date.now() + 60_000)
    })

    const response = await acceptLegalDocuments(
      jsonRequest('/api/legal-consent', 'POST', {
        privacyAccepted: true,
        termsAccepted: true
      }) as any
    )

    assert.equal(response.status, 401)
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'user.upsert'
      ),
      false
    )
  })

  test('requires both current document versions', async () => {
    testState.prisma['user.findUnique'] = () => ({
      privacy_policy_version: PRIVACY_POLICY_VERSION,
      privacy_policy_accepted_at: new Date(),
      terms_of_service_version: 'older-version',
      terms_of_service_accepted_at: new Date()
    })

    const response = await getLegalConsent(
      new Request('http://localhost/api/legal-consent') as any
    )
    const body = await responseJson(response)

    assert.equal(body.accepted, false)
    assert.equal(
      body.privacyPolicyVersion,
      PRIVACY_POLICY_VERSION
    )
    assert.equal(
      body.termsOfServiceVersion,
      TERMS_OF_SERVICE_VERSION
    )
  })

  test('records versioned affirmative acceptance', async () => {
    let upsertArgs: Record<string, any> | undefined
    testState.prisma['user.upsert'] = (args) => {
      upsertArgs = args
      return args
    }

    const response = await acceptLegalDocuments(
      jsonRequest('/api/legal-consent', 'POST', {
        privacyAccepted: true,
        termsAccepted: true
      }) as any
    )

    assert.equal(response.status, 200)
    assert.equal(
      upsertArgs?.update.privacy_policy_version,
      PRIVACY_POLICY_VERSION
    )
    assert.equal(
      upsertArgs?.update.terms_of_service_version,
      TERMS_OF_SERVICE_VERSION
    )
    assert.ok(
      upsertArgs?.update.privacy_policy_accepted_at instanceof
        Date
    )
  })

  test('rejects partial acceptance', async () => {
    const response = await acceptLegalDocuments(
      jsonRequest('/api/legal-consent', 'POST', {
        privacyAccepted: true,
        termsAccepted: false
      }) as any
    )

    assert.equal(response.status, 400)
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'user.upsert'
      ),
      false
    )
  })
})

describe('drawing and activity routes', () => {
  test('creates a draw box only on an owned page', async () => {
    testState.prisma['page.findFirst'] = ({ where }) => {
      assert.deepEqual(where, {
        id: PAGE_ID,
        user_id: USER_ID
      })
      return { id: PAGE_ID }
    }
    testState.prisma['drawBox.count'] = () => 0
    let createData: Record<string, any> | undefined
    testState.prisma['drawBox.create'] = ({ data }) => {
      createData = data
      return { id: DRAW_BOX_ID, ...data }
    }

    const response = await createDrawBox(
      jsonRequest('/api/draw-boxes', 'POST', {
        page_id: PAGE_ID,
        x_position: 10,
        y_position: 20,
        width: 300,
        height: 200
      }) as any
    )

    assert.equal(response.status, 201)
    assert.equal(createData?.page_id, PAGE_ID)
  })

  test('creates a validated element only in an owned draw box', async () => {
    testState.prisma['drawBox.findFirst'] = ({ where }) => {
      assert.equal(where.id, DRAW_BOX_ID)
      assert.equal(where.page.user_id, USER_ID)
      return { id: DRAW_BOX_ID }
    }
    testState.prisma['drawElement.count'] = () => 0
    let createData: Record<string, any> | undefined
    testState.prisma['drawElement.create'] = ({ data }) => {
      createData = data
      return { id: DRAW_ELEMENT_ID, ...data }
    }

    const response = await createDrawElement(
      jsonRequest('/api/draw-elements', 'POST', {
        draw_box_id: DRAW_BOX_ID,
        type: 'text',
        x: 10,
        y: 20,
        width: 100,
        height: 40,
        properties: { text: 'Diagram label' }
      }) as any
    )

    assert.equal(response.status, 201)
    assert.equal(createData?.draw_box_id, DRAW_BOX_ID)
    assert.deepEqual(createData?.properties, {
      text: 'Diagram label'
    })
  })

  test('does not delete an unowned drawing element', async () => {
    testState.prisma['drawElement.findFirst'] = () => null

    const response = await deleteDrawElement(
      jsonRequest(
        `/api/draw-elements/${DRAW_ELEMENT_ID}`,
        'DELETE'
      ) as any,
      {
        params: Promise.resolve({ id: DRAW_ELEMENT_ID })
      }
    )

    assert.equal(response.status, 404)
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'drawElement.delete'
      ),
      false
    )
  })

  test('loads, updates, and deletes an owned drawing element', async () => {
    testState.prisma['drawElement.findFirst'] = ({ where }) => {
      assert.equal(where.id, DRAW_ELEMENT_ID)
      assert.equal(where.draw_box.page.user_id, USER_ID)
      return { id: DRAW_ELEMENT_ID, x: 1 }
    }
    testState.prisma['drawElement.update'] = ({ where, data }) => ({
      id: where.id,
      ...data
    })
    let deleted = false
    testState.prisma['drawElement.delete'] = () => {
      deleted = true
      return { id: DRAW_ELEMENT_ID }
    }
    const context = {
      params: Promise.resolve({ id: DRAW_ELEMENT_ID })
    }

    const loaded = await getDrawElement(
      new Request(
        `http://localhost/api/draw-elements/${DRAW_ELEMENT_ID}`
      ) as any,
      context
    )
    assert.equal(loaded.status, 200)

    const updated = await updateDrawElement(
      jsonRequest(
        `/api/draw-elements/${DRAW_ELEMENT_ID}`,
        'PATCH',
        { x: 25, properties: { color: '#ffffff' } }
      ) as any,
      context
    )
    assert.equal(updated.status, 200)
    assert.equal((await responseJson(updated)).x, 25)

    const removed = await deleteDrawElement(
      jsonRequest(
        `/api/draw-elements/${DRAW_ELEMENT_ID}`,
        'DELETE'
      ) as any,
      context
    )
    assert.equal(removed.status, 200)
    assert.equal(deleted, true)
  })

  test('loads recent activity within the owned notebook scope', async () => {
    testState.prisma['page.findFirst'] = ({ where }) => {
      assert.deepEqual(where, {
        notebook_id: NOTEBOOK_ID,
        user_id: USER_ID
      })
      return { id: PAGE_ID }
    }

    const response = await getLatestPage(
      new Request(
        `http://localhost/api/notebooks/${NOTEBOOK_ID}/latest-page`
      ),
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 200)
    assert.equal((await responseJson(response)).id, PAGE_ID)
  })
})
