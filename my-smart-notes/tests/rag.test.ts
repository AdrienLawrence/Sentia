import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import {
  formatRetrievedContext,
  getNotebookQuizStats,
  indexOwnedNotebook,
  retrieveNotebookQuizContext,
  retrieveNotebookContext
} from '../src/lib/ai/rag.ts'
import {
  chunkTiptapContent,
  contentHash
} from '../src/lib/ai/tiptapText.ts'
import {
  resetTestState,
  testState
} from './mocks/state.ts'
import {
  NOTEBOOK_ID,
  PAGE_ID,
  USER_ID
} from './helpers.ts'

const PAGE_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Semantic retrieval should reuse unchanged notes.'
        }
      ]
    }
  ]
}

beforeEach(resetTestState)

describe('RAG indexing', () => {
  test('does not index a notebook the user does not own', async () => {
    testState.prisma['notebook.findFirst'] = () => null

    assert.equal(
      await indexOwnedNotebook(USER_ID, NOTEBOOK_ID),
      false
    )
    assert.equal(
      testState.calls.openai.some(
        (call) => call.method === 'createEmbeddings'
      ),
      false
    )
  })

  test('reuses stored vectors when every chunk hash matches', async () => {
    const [text] = chunkTiptapContent(PAGE_CONTENT)
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID,
      pages: [{ id: PAGE_ID, content: PAGE_CONTENT }]
    })
    testState.prisma.$queryRaw = () => [
      {
        page_id: PAGE_ID,
        chunk_index: 0,
        content_hash: contentHash(text)
      }
    ]

    assert.equal(
      await indexOwnedNotebook(USER_ID, NOTEBOOK_ID),
      true
    )
    assert.equal(
      testState.calls.openai.some(
        (call) => call.method === 'createEmbeddings'
      ),
      false
    )
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === '$executeRaw'
      ),
      false
    )
  })

  test('replaces vectors when page content changed', async () => {
    let embeddedTexts: string[] = []
    let writes = 0
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID,
      pages: [{ id: PAGE_ID, content: PAGE_CONTENT }]
    })
    testState.prisma.$queryRaw = () => []
    testState.prisma.$executeRaw = () => {
      writes += 1
      return 1
    }
    testState.openai.createEmbeddings = (texts) => {
      embeddedTexts = texts
      return texts.map(() =>
        Array.from({ length: 1536 }, () => 0.01)
      )
    }

    assert.equal(
      await indexOwnedNotebook(USER_ID, NOTEBOOK_ID),
      true
    )
    assert.deepEqual(
      embeddedTexts,
      chunkTiptapContent(PAGE_CONTENT)
    )
    assert.equal(writes, 2)
  })

  test('scopes semantic retrieval by both user and notebook', async () => {
    let queryValues: unknown[] = []
    testState.openai.createEmbeddings = () => [
      Array.from({ length: 1536 }, () => 0)
    ]
    testState.prisma.$queryRaw = (query) => {
      queryValues = query.values
      return []
    }

    await retrieveNotebookContext(
      USER_ID,
      NOTEBOOK_ID,
      'retrieval question',
      8
    )

    assert.ok(queryValues.includes(USER_ID))
    assert.ok(queryValues.includes(NOTEBOOK_ID))
    assert.ok(queryValues.includes(8))
  })

  test('scopes quiz statistics and sampling to the notebook owner', async () => {
    const queries: unknown[][] = []
    testState.prisma.$queryRaw = (query) => {
      queries.push(query.values)
      return queries.length === 1
        ? [{ characterCount: 5000, chunkCount: 4 }]
        : [
            {
              pageId: PAGE_ID,
              pageTitle: 'Quiz page',
              content: 'Grounded fact',
              similarity: 1
            }
          ]
    }

    const stats = await getNotebookQuizStats(
      USER_ID,
      NOTEBOOK_ID
    )
    const chunks = await retrieveNotebookQuizContext(
      USER_ID,
      NOTEBOOK_ID,
      8
    )

    assert.deepEqual(stats, {
      characterCount: 5000,
      chunkCount: 4
    })
    assert.equal(chunks[0].pageId, PAGE_ID)
    assert.ok(queries.every((values) => values.includes(USER_ID)))
    assert.ok(
      queries.every((values) => values.includes(NOTEBOOK_ID))
    )
    assert.match(
      formatRetrievedContext(chunks),
      /\[Source 1: Quiz page\]\nGrounded fact/
    )
  })
})
