import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'

import {
  AiSafetyError,
  createGroundedAnswer,
  createStructuredQuiz,
  moderateText
} from '../src/lib/ai/openai.ts'

const originalFetch = globalThis.fetch
const originalApiKey = process.env.OPENAI_API_KEY

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY
  } else {
    process.env.OPENAI_API_KEY = originalApiKey
  }
})

describe('OpenAI request controls', () => {
  test('sends no-store and safety identifier controls, then moderates output', async () => {
    let requestBody: Record<string, any> | undefined
    let moderationBody: Record<string, any> | undefined
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body))

      if (String(url).endsWith('/moderations')) {
        moderationBody = body
        return Response.json({ results: [{ flagged: false }] })
      }

      requestBody = body
      return Response.json({
        output: [
          {
            content: [
              { type: 'output_text', text: 'Safe response' }
            ]
          }
        ]
      })
    }

    const result = await createGroundedAnswer(
      '{"untrustedData":{"question":"hello"}}',
      'Developer boundary',
      {
        safetyIdentifier: 'safe-user-hash',
        maxOutputTokens: 300
      }
    )

    assert.equal(result.answer, 'Safe response')
    assert.equal(requestBody?.store, false)
    assert.equal(requestBody?.moderation, undefined)
    assert.equal(
      requestBody?.safety_identifier,
      'safe-user-hash'
    )
    assert.equal(
      moderationBody?.model,
      'omni-moderation-latest'
    )
    assert.equal(moderationBody?.input, 'Safe response')
  })

  test('rejects flagged generated responses', async () => {
    globalThis.fetch = async (url) =>
      String(url).endsWith('/moderations')
        ? Response.json({ results: [{ flagged: true }] })
        :
      Response.json({
        output: [
          {
            content: [
              { type: 'output_text', text: 'Unsafe response' }
            ]
          }
        ]
      })

    await assert.rejects(
      () =>
        createGroundedAnswer('{}', 'Boundary', {
          safetyIdentifier: 'safe-user-hash'
        }),
      AiSafetyError
    )
  })

  test('rejects a flagged standalone user instruction', async () => {
    globalThis.fetch = async () =>
      Response.json({
        results: [{ flagged: true }]
      })

    await assert.rejects(
      () => moderateText('Flagged request'),
      AiSafetyError
    )
  })

  test('applies the same controls to quiz generation', async () => {
    let requestBody: Record<string, any> | undefined
    let moderationBody: Record<string, any> | undefined
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(String(init?.body))

      if (String(url).endsWith('/moderations')) {
        moderationBody = body
        return Response.json({ results: [{ flagged: false }] })
      }

      requestBody = body
      return Response.json({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  title: 'Quiz',
                  questions: []
                })
              }
            ]
          }
        ]
      })
    }

    await createStructuredQuiz(
      '{}',
      'Quiz boundary',
      3,
      'safe-user-hash'
    )

    assert.equal(requestBody?.store, false)
    assert.equal(requestBody?.moderation, undefined)
    assert.equal(
      requestBody?.safety_identifier,
      'safe-user-hash'
    )
    assert.equal(
      moderationBody?.model,
      'omni-moderation-latest'
    )
  })
})
