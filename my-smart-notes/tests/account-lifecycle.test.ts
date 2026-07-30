import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, test } from 'node:test'

import { DELETE as deleteAccount } from '../src/app/api/account/route.ts'
import {
  GET as verifyRecoverySession,
  POST as updateRecoveredPassword
} from '../src/app/api/account/recovery/route.ts'
import { POST as requestPasswordRecovery } from '../src/app/api/account/recovery/request/route.ts'
import { hashDeletedAccountId } from '../src/lib/accountDeletion.ts'
import { PASSWORD_RECOVERY_COOKIE } from '../src/lib/passwordRecovery.ts'
import {
  USER_ID,
  jsonRequest,
  responseJson
} from './helpers.ts'
import {
  resetTestState,
  testState
} from './mocks/state.ts'

const originalServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY

before(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

after(() => {
  if (originalServiceRoleKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      originalServiceRoleKey
  }
})

beforeEach(() => {
  resetTestState()
  testState.prisma['deletedAccountTombstone.deleteMany'] = () => ({
    count: 0
  })
  testState.prisma['deletedAccountTombstone.upsert'] = ({
    create
  }) => create
})

describe('account deletion', () => {
  test('deletes application data, rate-limit records, and the Auth identity', async () => {
    testState.prisma['user.deleteMany'] = ({ where }) => {
      assert.deepEqual(where, { id: USER_ID })
      return { count: 1 }
    }
    testState.prisma['apiRateLimit.deleteMany'] = ({ where }) => {
      assert.deepEqual(where, {
        key: {
          startsWith: `${USER_ID}:`
        }
      })
      return { count: 2 }
    }

    const response = await deleteAccount(
      jsonRequest('/api/account', 'DELETE', {
        confirmation: 'DELETE'
      })
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await responseJson(response), {
      deleted: true
    })
    assert.deepEqual(
      testState.calls.auth.find(
        (call) => call.method === 'deleteUser'
      ),
      {
        method: 'deleteUser',
        args: [USER_ID]
      }
    )
    const tombstoneCall = testState.calls.prisma.find(
      (call) =>
        call.method === 'deletedAccountTombstone.upsert'
    )
    assert.equal(
      tombstoneCall?.args[0].create.account_hash,
      hashDeletedAccountId(USER_ID)
    )
    assert.equal(
      tombstoneCall?.args[0].create.account_hash.includes(USER_ID),
      false
    )
  })

  test('requires exact typed confirmation before deleting data', async () => {
    const response = await deleteAccount(
      jsonRequest('/api/account', 'DELETE', {
        confirmation: 'delete'
      })
    )

    assert.equal(response.status, 400)
    assert.match(
      String((await responseJson(response)).error),
      /Type DELETE/
    )
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'user.deleteMany'
      ),
      false
    )
  })

  test('rejects cross-origin deletion before touching account data', async () => {
    const response = await deleteAccount(
      jsonRequest(
        '/api/account',
        'DELETE',
        { confirmation: 'DELETE' },
        'https://attacker.example'
      )
    )

    assert.equal(response.status, 403)
    assert.equal(testState.calls.auth.length, 0)
  })

  test('preserves account data when deletion is not configured', async () => {
    const configuredKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    try {
      const response = await deleteAccount(
        jsonRequest('/api/account', 'DELETE', {
          confirmation: 'DELETE'
        })
      )

      assert.equal(response.status, 503)
      assert.equal(
        testState.calls.prisma.some(
          (call) => call.method === 'user.deleteMany'
        ),
        false
      )
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = configuredKey
    }
  })

  test('reports a retryable partial failure when Auth deletion fails', async () => {
    testState.prisma['user.deleteMany'] = () => ({ count: 1 })
    testState.prisma['apiRateLimit.deleteMany'] = () => ({
      count: 1
    })
    testState.auth.deleteUser = () => ({
      error: new Error('Provider unavailable')
    })

    const response = await deleteAccount(
      jsonRequest('/api/account', 'DELETE', {
        confirmation: 'DELETE'
      })
    )

    assert.equal(response.status, 502)
    assert.match(
      String((await responseJson(response)).error),
      /must be retried/
    )
  })
})

describe('password recovery session', () => {
  test('sends a normalized recovery request without revealing account existence', async () => {
    const response = await requestPasswordRecovery(
      jsonRequest('/api/account/recovery/request', 'POST', {
        email: '  Tester@Example.com ',
        website: ''
      })
    )

    assert.equal(response.status, 202)
    assert.deepEqual(await responseJson(response), {
      sent: true,
      message:
        'If that address has a password account, a recovery link has been sent.'
    })
    assert.deepEqual(
      testState.calls.auth.find(
        (call) => call.method === 'resetPasswordForEmail'
      ),
      {
        method: 'resetPasswordForEmail',
        args: [
          'tester@example.com',
          {
            redirectTo:
              'http://localhost/auth/callback?next=/reset-password&flow=recovery'
          }
        ]
      }
    )
  })

  test('silently ignores a bot-trap recovery submission', async () => {
    const response = await requestPasswordRecovery(
      jsonRequest('/api/account/recovery/request', 'POST', {
        email: 'tester@example.com',
        website: 'https://spam.example'
      })
    )

    assert.equal(response.status, 202)
    assert.equal(
      testState.calls.auth.some(
        (call) => call.method === 'resetPasswordForEmail'
      ),
      false
    )
  })

  test('rate limits public recovery requests before sending email', async () => {
    testState.prisma.$queryRaw = () => [{ count: 6 }]

    const response = await requestPasswordRecovery(
      jsonRequest('/api/account/recovery/request', 'POST', {
        email: 'tester@example.com',
        website: ''
      })
    )

    assert.equal(response.status, 429)
    assert.equal(
      testState.calls.auth.some(
        (call) => call.method === 'resetPasswordForEmail'
      ),
      false
    )
  })

  test('does not accept an ordinary signed-in session as password recovery', async () => {
    const response = await verifyRecoverySession(
      new Request('http://localhost/api/account/recovery')
    )

    assert.equal(response.status, 401)
    assert.equal(testState.calls.auth.length, 0)
  })

  test('updates a password only after verified recovery and consumes the marker', async () => {
    const response = await updateRecoveredPassword(
      new Request('http://localhost/api/account/recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${PASSWORD_RECOVERY_COOKIE}=verified`,
          Origin: 'http://localhost'
        },
        body: JSON.stringify({
          password: 'new-secure-password'
        })
      })
    )

    assert.equal(response.status, 200)
    assert.deepEqual(
      testState.calls.auth.find(
        (call) => call.method === 'updateUser'
      ),
      {
        method: 'updateUser',
        args: [{ password: 'new-secure-password' }]
      }
    )
    assert.match(
      response.headers.get('set-cookie') ?? '',
      new RegExp(`${PASSWORD_RECOVERY_COOKIE}=`)
    )
    assert.match(
      response.headers.get('set-cookie') ?? '',
      /Max-Age=0/
    )
  })
})
