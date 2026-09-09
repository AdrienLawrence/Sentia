import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import {
  GET as listNotebooks,
  POST as createNotebook
} from '../src/app/api/notebooks/route.ts'
import {
  DELETE as deleteNotebookById,
  GET as getNotebook,
  PATCH as updateNotebook
} from '../src/app/api/notebooks/[id]/route.ts'
import {
  GET as listPages,
  PATCH as reorderPages,
  POST as createPage
} from '../src/app/api/notebooks/[id]/pages/route.ts'
import {
  DELETE as deletePage,
  GET as getPage,
  PATCH as updatePage
} from '../src/app/api/pages/[id]/route.ts'
import {
  resetTestState,
  testState
} from './mocks/state.ts'
import {
  NOTEBOOK_ID,
  PAGE_ID,
  SECOND_PAGE_ID,
  USER_ID,
  jsonRequest,
  responseJson
} from './helpers.ts'

beforeEach(() => {
  resetTestState()
  testState.prisma['notebook.updateMany'] = () => ({
    count: 1
  })
})

describe('notebook lifecycle routes', () => {
  test('lists only the authenticated user notebooks', async () => {
    testState.prisma['notebook.findMany'] = ({ where }) => {
      assert.deepEqual(where, { user_id: USER_ID })
      return [
        {
          id: NOTEBOOK_ID,
          pages: [{ id: PAGE_ID }]
        }
      ]
    }

    const response = await listNotebooks(
      new Request('http://localhost/api/notebooks') as any
    )

    assert.equal(response.status, 200)
    const notebooks = await responseJson(response)
    assert.equal(notebooks[0].id, NOTEBOOK_ID)
    assert.equal(notebooks[0].latestPageId, PAGE_ID)
    assert.equal(notebooks[0].pages, undefined)
  })

  test('creates an owned notebook with safe defaults', async () => {
    let createData: Record<string, unknown> | undefined
    testState.prisma['notebook.count'] = () => 0
    testState.prisma['user.upsert'] = () => ({ id: USER_ID })
    testState.prisma['notebook.create'] = ({ data }) => {
      createData = data
      return { id: NOTEBOOK_ID, ...data }
    }

    const response = await createNotebook(
      jsonRequest('/api/notebooks', 'POST', {}) as any
    )

    assert.equal(response.status, 201)
    assert.deepEqual(createData, {
      name: 'My Notebook',
      style: 'blank',
      user_id: USER_ID,
      revision: 0
    })
    assert.deepEqual(
      testState.calls.prisma.find(
        (call) => call.method === '$transaction'
      )?.args[1],
      { isolationLevel: 'Serializable' }
    )
  })

  test('creates a notebook and initial page atomically when requested', async () => {
    testState.prisma['notebook.count'] = () => 0
    testState.prisma['user.upsert'] = () => ({ id: USER_ID })
    testState.prisma['notebook.create'] = ({ data }) => ({
      id: NOTEBOOK_ID,
      ...data
    })
    testState.prisma['page.create'] = ({ data }) => ({
      id: PAGE_ID,
      ...data
    })

    const response = await createNotebook(
      jsonRequest('/api/notebooks', 'POST', {
        createInitialPage: true
      }) as any
    )
    const created = await responseJson(response)

    assert.equal(response.status, 201)
    assert.equal(created.id, NOTEBOOK_ID)
    assert.equal(created.initialPageId, PAGE_ID)
    assert.equal(created.latestPageId, PAGE_ID)
    assert.deepEqual(created._count, { pages: 1 })

    const notebookCreate = testState.calls.prisma.find(
      (call) => call.method === 'notebook.create'
    )
    const pageCreate = testState.calls.prisma.find(
      (call) => call.method === 'page.create'
    )
    assert.equal(notebookCreate?.args[0].data.revision, 1)
    assert.equal(pageCreate?.args[0].data.notebook_id, NOTEBOOK_ID)
  })

  test('rejects cross-origin notebook creation', async () => {
    const response = await createNotebook(
      jsonRequest(
        '/api/notebooks',
        'POST',
        {},
        'https://malicious.example'
      ) as any
    )

    assert.equal(response.status, 403)
    assert.equal(
      (await responseJson(response)).error,
      'Invalid request origin'
    )
    assert.equal(testState.calls.prisma.length, 0)
  })

  test('deletes only a notebook owned by the user', async () => {
    testState.prisma['notebook.findFirst'] = ({ where }) => {
      assert.deepEqual(where, {
        id: NOTEBOOK_ID,
        user_id: USER_ID
      })
      return { id: NOTEBOOK_ID }
    }
    let deletedId = ''
    testState.prisma['notebook.delete'] = ({ where }) => {
      deletedId = where.id
      return { id: where.id }
    }

    const response = await deleteNotebookById(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}`,
        'DELETE'
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 200)
    assert.equal(deletedId, NOTEBOOK_ID)
  })

  test('loads and renames only an owned notebook', async () => {
    testState.prisma['notebook.findFirst'] = ({ where }) => {
      assert.equal(where.user_id, USER_ID)
      return { id: NOTEBOOK_ID, name: 'Before' }
    }
    testState.prisma['notebook.update'] = ({ where, data }) => ({
      id: where.id,
      ...data
    })

    const loaded = await getNotebook(
      new Request(
        `http://localhost/api/notebooks/${NOTEBOOK_ID}`
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )
    assert.equal(loaded.status, 200)

    const updated = await updateNotebook(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}`,
        'PATCH',
        {
          name: 'After',
          expectedRevision: 0
        }
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )
    assert.equal(updated.status, 200)
    assert.equal(
      (await responseJson(updated)).name,
      'After'
    )
  })

  test('records notebook activity with one ownership-scoped update', async () => {
    testState.prisma['notebook.findFirst'] = () => {
      throw new Error('markOpened should not require a separate lookup')
    }
    testState.prisma['notebook.updateMany'] = ({ where, data }) => {
      assert.deepEqual(where, {
        id: NOTEBOOK_ID,
        user_id: USER_ID
      })
      assert.ok(data.last_opened_at instanceof Date)
      return { count: 1 }
    }

    const response = await updateNotebook(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}`,
        'PATCH',
        {
          markOpened: true
        }
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 200)
    assert.equal((await responseJson(response)).success, true)
  })

  test('does not delete an unowned notebook', async () => {
    testState.prisma['notebook.findFirst'] = () => null

    const response = await deleteNotebookById(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}`,
        'DELETE'
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 404)
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'notebook.delete'
      ),
      false
    )
  })
})

describe('page lifecycle routes', () => {
  test('lists only pages inside an owned notebook', async () => {
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID
    })
    testState.prisma['page.findMany'] = ({ where }) => {
      assert.deepEqual(where, {
        notebook_id: NOTEBOOK_ID,
        user_id: USER_ID
      })
      return [{ id: PAGE_ID }]
    }

    const response = await listPages(
      new Request(
        `http://localhost/api/notebooks/${NOTEBOOK_ID}/pages`
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 200)
    assert.equal((await responseJson(response))[0].id, PAGE_ID)
  })

  test('loads a lightweight page directory without document content', async () => {
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID
    })
    testState.prisma['page.findMany'] = (args) => {
      assert.equal(args.select.id, true)
      assert.equal(args.select.title, true)
      assert.equal(args.select.content, undefined)
      return [
        {
          id: PAGE_ID,
          title: 'Directory page',
          page_number: 1
        }
      ]
    }

    const response = await listPages(
      new Request(
        `http://localhost/api/notebooks/${NOTEBOOK_ID}/pages?view=summary`
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )
    const directory = await responseJson(response)

    assert.equal(response.status, 200)
    assert.equal(directory[0].id, PAGE_ID)
    assert.equal(directory[0].content, undefined)
  })

  test('loads only a bounded owned batch of requested page content', async () => {
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID
    })
    testState.prisma['page.findMany'] = ({ where }) => {
      assert.deepEqual(where, {
        notebook_id: NOTEBOOK_ID,
        user_id: USER_ID,
        id: {
          in: [SECOND_PAGE_ID, PAGE_ID]
        }
      })

      return [
        { id: PAGE_ID, content: { type: 'doc' } },
        { id: SECOND_PAGE_ID, content: { type: 'doc' } }
      ]
    }

    const response = await listPages(
      new Request(
        `http://localhost/api/notebooks/${NOTEBOOK_ID}/pages?view=content&ids=${SECOND_PAGE_ID},${PAGE_ID}`
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )
    const loadedPages = await responseJson(response)

    assert.equal(response.status, 200)
    assert.deepEqual(
      loadedPages.map((loadedPage: { id: string }) => loadedPage.id),
      [SECOND_PAGE_ID, PAGE_ID]
    )
  })

  test('creates the next page without trusting a supplied order', async () => {
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID
    })
    testState.prisma['page.count'] = () => 2
    testState.prisma['page.findFirst'] = () => ({
      page_number: 7
    })
    let createData: Record<string, unknown> | undefined
    testState.prisma['page.create'] = ({ data }) => {
      createData = data
      return { id: PAGE_ID, ...data }
    }

    const response = await createPage(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}/pages`,
        'POST',
        {
          title: 'Imported page',
          page_number: 999,
          expectedRevision: 0
        }
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 201)
    assert.equal(createData?.page_number, 8)
    assert.equal(createData?.user_id, USER_ID)
    assert.equal(createData?.notebook_id, NOTEBOOK_ID)
  })

  test('updates content only after an ownership check', async () => {
    testState.prisma['page.findFirst'] = ({ where }) => {
      assert.deepEqual(where, {
        id: PAGE_ID,
        user_id: USER_ID
      })
      return {
        id: PAGE_ID,
        notebook_id: NOTEBOOK_ID
      }
    }
    let updateData: Record<string, unknown> | undefined
    testState.prisma['page.update'] = ({ data }) => {
      updateData = data
      return { id: PAGE_ID, ...data }
    }
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Saved' }]
        }
      ]
    }

    const response = await updatePage(
      jsonRequest(`/api/pages/${PAGE_ID}`, 'PATCH', {
        title: 'Updated',
        content,
        expectedRevision: 0
      }) as any,
      { params: Promise.resolve({ id: PAGE_ID }) }
    )

    assert.equal(response.status, 200)
    assert.equal(
      response.headers.get('X-Sentia-Notebook-Revision'),
      '1'
    )
    assert.equal(updateData?.title, 'Updated')
    assert.deepEqual(updateData?.content, content)
    assert.ok(updateData?.updated_at instanceof Date)
  })

  test('loads a page only through the user ownership scope', async () => {
    testState.prisma['page.findFirst'] = ({ where }) => {
      assert.deepEqual(where, {
        id: PAGE_ID,
        user_id: USER_ID
      })
      return { id: PAGE_ID, title: 'Owned page' }
    }

    const response = await getPage(
      new Request(`http://localhost/api/pages/${PAGE_ID}`) as any,
      { params: Promise.resolve({ id: PAGE_ID }) }
    )

    assert.equal(response.status, 200)
    assert.equal((await responseJson(response)).id, PAGE_ID)
  })

  test('deletes an owned page and refuses an unowned page', async () => {
    testState.prisma['page.findFirst'] = () => ({
      id: PAGE_ID,
      notebook_id: NOTEBOOK_ID
    })
    let deleteCount = 0
    testState.prisma['page.delete'] = () => {
      deleteCount += 1
      return { id: PAGE_ID }
    }

    const deleted = await deletePage(
      jsonRequest(`/api/pages/${PAGE_ID}`, 'DELETE', {
        expectedRevision: 0
      }) as any,
      { params: Promise.resolve({ id: PAGE_ID }) }
    )
    assert.equal(deleted.status, 200)
    assert.equal(deleteCount, 1)

    resetTestState()
    testState.prisma['page.findFirst'] = () => null
    const rejected = await deletePage(
      jsonRequest(`/api/pages/${PAGE_ID}`, 'DELETE') as any,
      { params: Promise.resolve({ id: PAGE_ID }) }
    )
    assert.equal(rejected.status, 404)
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'page.delete'
      ),
      false
    )
  })

  test('reorders only an exact set of owned pages', async () => {
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID
    })
    testState.prisma['page.findMany'] = () => [
      { id: PAGE_ID },
      { id: SECOND_PAGE_ID }
    ]
    const updates: Array<Record<string, any>> = []
    testState.prisma['page.update'] = (args) => {
      updates.push(args)
      return args
    }

    const response = await reorderPages(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}/pages`,
        'PATCH',
        {
          pageIds: [SECOND_PAGE_ID, PAGE_ID],
          pendingDeletionPageIds: [],
          expectedRevision: 0
        }
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 200)
    assert.deepEqual(
      updates.map(({ where, data }) => ({
        id: where.id,
        pageNumber: data.page_number
      })),
      [
        { id: SECOND_PAGE_ID, pageNumber: 1 },
        { id: PAGE_ID, pageNumber: 2 }
      ]
    )
  })

  test('rejects a page order containing foreign IDs', async () => {
    testState.prisma['notebook.findFirst'] = () => ({
      id: NOTEBOOK_ID
    })
    testState.prisma['page.findMany'] = () => [
      { id: PAGE_ID },
      { id: SECOND_PAGE_ID }
    ]

    const response = await reorderPages(
      jsonRequest(
        `/api/notebooks/${NOTEBOOK_ID}/pages`,
        'PATCH',
        {
          pageIds: [
            PAGE_ID,
            'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
          ],
          pendingDeletionPageIds: [],
          expectedRevision: 0
        }
      ) as any,
      { params: Promise.resolve({ id: NOTEBOOK_ID }) }
    )

    assert.equal(response.status, 400)
    assert.equal(
      testState.calls.prisma.some(
        (call) => call.method === 'page.update'
      ),
      false
    )
  })

  test('rejects a stale page update before changing content', async () => {
    testState.prisma['page.findFirst'] = () => ({
      id: PAGE_ID,
      notebook_id: NOTEBOOK_ID
    })
    testState.prisma['notebook.updateMany'] = () => ({
      count: 0
    })
    let updated = false
    testState.prisma['page.update'] = () => {
      updated = true
      return { id: PAGE_ID }
    }

    const response = await updatePage(
      jsonRequest(`/api/pages/${PAGE_ID}`, 'PATCH', {
        content: {
          type: 'doc',
          content: []
        },
        expectedRevision: 4
      }) as any,
      { params: Promise.resolve({ id: PAGE_ID }) }
    )

    assert.equal(response.status, 409)
    assert.equal(updated, false)
    assert.match(
      (await responseJson(response)).error,
      /newer notebook version/i
    )
  })
})
