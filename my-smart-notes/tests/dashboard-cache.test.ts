import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import {
  clearNotebookSessionCache,
  markNotebookOpenedInSessionCache,
  readNotebookSessionCache,
  writeNotebookSessionCache
} from '../src/features/dashboard/lib/notebookSessionCache.ts'
import type {
  DashboardNotebook
} from '../src/features/dashboard/model/types.ts'
import { NOTEBOOK_ID, USER_ID } from './helpers.ts'

const storage = new Map<string, string>()

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
    }
  }
})

const notebook: DashboardNotebook = {
  id: NOTEBOOK_ID,
  name: 'Cached notebook',
  style: 'standard',
  created_at: '2026-07-28T12:00:00.000Z',
  last_opened_at: null,
  revision: 4,
  user_id: USER_ID,
  latestPageId:
    '22222222-2222-4222-8222-222222222222',
  _count: {
    pages: 12
  }
}

beforeEach(() => {
  storage.clear()
})

describe('dashboard notebook session cache', () => {
  test('stores notebook metadata under the authenticated user', () => {
    writeNotebookSessionCache(
      USER_ID,
      [notebook],
      '"dashboard-etag"'
    )

    const cached = readNotebookSessionCache(USER_ID)

    assert.equal(cached?.notebooks.length, 1)
    assert.equal(cached?.notebooks[0].id, NOTEBOOK_ID)
    assert.equal(cached?.etag, '"dashboard-etag"')
    assert.equal(
      readNotebookSessionCache(
        '22222222-2222-4222-8222-222222222222'
      ),
      null
    )
  })

  test('updates only the opened notebook and clears on logout', () => {
    writeNotebookSessionCache(USER_ID, [notebook])
    const openedAt = '2026-07-28T13:00:00.000Z'

    markNotebookOpenedInSessionCache(
      USER_ID,
      NOTEBOOK_ID,
      openedAt,
      '33333333-3333-4333-8333-333333333333'
    )

    assert.equal(
      readNotebookSessionCache(USER_ID)?.notebooks[0]
        .last_opened_at,
      openedAt
    )
    assert.equal(
      readNotebookSessionCache(USER_ID)?.notebooks[0]
        .latestPageId,
      '33333333-3333-4333-8333-333333333333'
    )

    clearNotebookSessionCache(USER_ID)
    assert.equal(readNotebookSessionCache(USER_ID), null)
  })
})
