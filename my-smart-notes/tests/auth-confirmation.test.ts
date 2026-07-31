import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'
import { NextRequest } from 'next/server'

import { GET as confirmEmail } from '../src/app/auth/confirm/route.ts'
import { GET as exchangeAuthCode } from '../src/app/auth/callback/route.ts'
import {
  resetTestState,
  testState
} from './mocks/state.ts'

describe('email confirmation route', () => {
  beforeEach(resetTestState)

  test('verifies a token hash and starts the dashboard session', async () => {
    const response = await confirmEmail(
      new NextRequest(
        'http://localhost/auth/confirm?token_hash=fresh-token&type=email'
      )
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/dashboard'
    )
    assert.deepEqual(testState.calls.auth[0], {
      method: 'verifyOtp',
      args: [
        {
          token_hash: 'fresh-token',
          type: 'email'
        }
      ]
    })
  })

  test('returns failed verification to the resend recovery UI', async () => {
    testState.auth.verifyOtp = () => ({
      error: new Error('Token expired')
    })

    const response = await confirmEmail(
      new NextRequest(
        'http://localhost/auth/confirm?token_hash=expired-token&type=email'
      )
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/login?confirmation=failed'
    )
  })

  test('rejects a confirmation request without a token', async () => {
    const response = await confirmEmail(
      new NextRequest('http://localhost/auth/confirm?type=email')
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/login?confirmation=failed'
    )
    assert.equal(testState.calls.auth.length, 0)
  })

  test('sends a verified recovery token to the password form', async () => {
    const response = await confirmEmail(
      new NextRequest(
        'http://localhost/auth/confirm?token_hash=fresh-token&type=recovery'
      )
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/reset-password'
    )
    assert.match(
      response.headers.get('set-cookie') ?? '',
      /sentia-password-recovery=verified/
    )
  })

  test('exchanges a PKCE email code and opens the dashboard', async () => {
    const response = await exchangeAuthCode(
      new NextRequest(
        'http://localhost/auth/callback?code=email-code&next=/dashboard&flow=email'
      )
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/dashboard'
    )
    assert.deepEqual(
      testState.calls.auth.find(
        (call) => call.method === 'exchangeCodeForSession'
      ),
      {
        method: 'exchangeCodeForSession',
        args: ['email-code']
      }
    )
  })

  test('exchanges a PKCE recovery code and opens the password form', async () => {
    const response = await exchangeAuthCode(
      new NextRequest(
        'http://localhost/auth/callback?code=recovery-code&next=/reset-password&flow=recovery'
      )
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/reset-password'
    )
    assert.deepEqual(
      testState.calls.auth.find(
        (call) => call.method === 'exchangeCodeForSession'
      ),
      {
        method: 'exchangeCodeForSession',
        args: ['recovery-code']
      }
    )
    assert.match(
      response.headers.get('set-cookie') ?? '',
      /sentia-password-recovery=verified/
    )
  })

  test('returns a failed PKCE recovery to the recovery UI', async () => {
    testState.auth.exchangeCodeForSession = () => ({
      error: new Error('Code expired')
    })

    const response = await exchangeAuthCode(
      new NextRequest(
        'http://localhost/auth/callback?code=expired&next=/reset-password&flow=recovery'
      )
    )

    assert.equal(
      response.headers.get('location'),
      'http://localhost/forgot-password?recovery=failed'
    )
  })
})
