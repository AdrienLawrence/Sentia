import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { NotebookPage } from '../src/features/editor/model/types.ts'
import {
  createConnectedMarkdownDirectory,
  markdownMirrorContents,
  markdownMirrorFileName,
  syncNotebookToDirectory,
  type LocalDirectoryHandle
} from '../src/features/local-mirror/lib/localMarkdownMirror.ts'

class MemoryDirectory implements LocalDirectoryHandle {
  name: string
  directories = new Map<string, MemoryDirectory>()
  files = new Map<string, string>()
  writes = new Map<string, number>()

  constructor(name = 'Sentia Notes') {
    this.name = name
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ) {
    const existing = this.directories.get(name)
    if (existing) return existing

    if (this.files.has(name)) {
      throw new DOMException(
        'A file already uses this name',
        'TypeMismatchError'
      )
    }

    if (!options?.create) {
      throw new DOMException('Missing directory', 'NotFoundError')
    }

    const directory = new MemoryDirectory(name)
    this.directories.set(name, directory)
    return directory
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean }
  ) {
    if (!this.files.has(name) && !options?.create) {
      throw new DOMException('Missing file', 'NotFoundError')
    }

    return {
      getFile: async () =>
        ({
          text: async () => this.files.get(name) ?? ''
        }) as File,
      createWritable: async () => {
        let nextContents = ''

        return {
          write: async (contents: string) => {
            nextContents = contents
          },
          close: async () => {
            this.files.set(name, nextContents)
            this.writes.set(
              name,
              (this.writes.get(name) ?? 0) + 1
            )
          }
        }
      }
    }
  }

  async queryPermission() {
    return 'granted' as const
  }

  async requestPermission() {
    return 'granted' as const
  }

  async removeEntry(name: string) {
    if (!this.files.delete(name)) {
      throw new DOMException('Missing file', 'NotFoundError')
    }
  }
}

const NOTEBOOK_ID = '11111111-1111-4111-8111-111111111111'

function page(
  id: string,
  title: string,
  text: string,
  pageNumber: number
): NotebookPage {
  return {
    id,
    title,
    page_number: pageNumber,
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }]
        }
      ]
    }
  }
}

describe('local Markdown mirroring', () => {
  test('creates a dedicated notebook folder inside the selected location', async () => {
    const parentDirectory = new MemoryDirectory('Documents')

    const connectedDirectory =
      await createConnectedMarkdownDirectory({
        parentDirectory,
        notebookId: NOTEBOOK_ID,
        notebookName: 'Database Systems'
      })

    assert.equal(connectedDirectory.name, 'Sentia - Database Systems')
    assert.equal(
      parentDirectory.directories.get('Sentia - Database Systems'),
      connectedDirectory
    )
  })

  test('does not connect an existing unrelated folder with the same name', async () => {
    const parentDirectory = new MemoryDirectory('Documents')
    parentDirectory.directories.set(
      'Sentia - Database Systems',
      new MemoryDirectory('Sentia - Database Systems')
    )

    const connectedDirectory =
      await createConnectedMarkdownDirectory({
        parentDirectory,
        notebookId: NOTEBOOK_ID,
        notebookName: 'Database Systems'
      })

    assert.equal(
      connectedDirectory.name,
      'Sentia - Database Systems (2)'
    )
  })

  test('does not fail when a regular file occupies the desired folder name', async () => {
    const parentDirectory = new MemoryDirectory('Documents')
    parentDirectory.files.set(
      'Sentia - Database Systems',
      'Unrelated file'
    )

    const connectedDirectory =
      await createConnectedMarkdownDirectory({
        parentDirectory,
        notebookId: NOTEBOOK_ID,
        notebookName: 'Database Systems'
      })

    assert.equal(
      connectedDirectory.name,
      'Sentia - Database Systems (2)'
    )
  })

  test('creates readable filenames and stable ownership metadata', () => {
    const notebookPage = page(
      '22222222-2222-4222-8222-222222222222',
      'SQL: Queries?',
      'SELECT * FROM notes;',
      3
    )

    assert.equal(
      markdownMirrorFileName(notebookPage),
      'SQL Queries--22222222.md'
    )
    assert.match(
      markdownMirrorContents(NOTEBOOK_ID, notebookPage),
      /sentia_page_id: "22222222-2222-4222-8222-222222222222"/
    )
    assert.match(
      markdownMirrorContents(NOTEBOOK_ID, notebookPage),
      /# SQL: Queries\?\n\nSELECT \* FROM notes;/
    )
  })

  test('updates, renames, and removes only manifest-owned files', async () => {
    const directory = new MemoryDirectory()
    const firstPage = page(
      '22222222-2222-4222-8222-222222222222',
      'First',
      'Original text',
      1
    )
    const secondPage = page(
      '33333333-3333-4333-8333-333333333333',
      'Second',
      'Second page',
      2
    )

    directory.files.set('personal.md', 'Never touch this file.')

    await syncNotebookToDirectory({
      directory,
      notebookId: NOTEBOOK_ID,
      notebookName: 'Test Notebook',
      pages: [firstPage, secondPage]
    })

    const originalFirstName = markdownMirrorFileName(firstPage)
    const originalSecondName = markdownMirrorFileName(secondPage)
    assert.ok(directory.files.has(originalFirstName))
    assert.ok(directory.files.has(originalSecondName))

    const renamedPage = {
      ...firstPage,
      title: 'Renamed',
      content: page(
        firstPage.id,
        'Renamed',
        'Updated text',
        1
      ).content
    }

    await syncNotebookToDirectory({
      directory,
      notebookId: NOTEBOOK_ID,
      notebookName: 'Test Notebook',
      pages: [renamedPage]
    })

    assert.equal(directory.files.get('personal.md'), 'Never touch this file.')
    assert.equal(directory.files.has(originalFirstName), false)
    assert.equal(directory.files.has(originalSecondName), false)
    assert.match(
      directory.files.get(markdownMirrorFileName(renamedPage)) ?? '',
      /Updated text/
    )
  })

  test('does not overwrite a colliding unmanaged Markdown file', async () => {
    const directory = new MemoryDirectory()
    const notebookPage = page(
      '44444444-4444-4444-8444-444444444444',
      'Collision',
      'Sentia content',
      1
    )
    const desiredName = markdownMirrorFileName(notebookPage)
    directory.files.set(desiredName, 'Unmanaged local content')

    await syncNotebookToDirectory({
      directory,
      notebookId: NOTEBOOK_ID,
      notebookName: 'Test Notebook',
      pages: [notebookPage]
    })

    assert.equal(
      directory.files.get(desiredName),
      'Unmanaged local content'
    )
    assert.match(
      directory.files.get('Collision--44444444-2.md') ?? '',
      /Sentia content/
    )
  })

  test('does not rewrite an unchanged managed page', async () => {
    const directory = new MemoryDirectory()
    const notebookPage = page(
      '55555555-5555-4555-8555-555555555555',
      'Stable',
      'Unchanged content',
      1
    )
    const sync = () =>
      syncNotebookToDirectory({
        directory,
        notebookId: NOTEBOOK_ID,
        notebookName: 'Test Notebook',
        pages: [notebookPage]
      })

    await sync()
    const fileName = markdownMirrorFileName(notebookPage)
    assert.equal(directory.writes.get(fileName), 1)

    await sync()
    assert.equal(directory.writes.get(fileName), 1)
  })

  test('stops before writing when a queued sync is cancelled', async () => {
    const directory = new MemoryDirectory()

    await assert.rejects(
      syncNotebookToDirectory({
        directory,
        notebookId: NOTEBOOK_ID,
        notebookName: 'Test Notebook',
        pages: [
          page(
            '66666666-6666-4666-8666-666666666666',
            'Cancelled',
            'Do not write',
            1
          )
        ],
        shouldContinue: () => false
      }),
      (error) =>
        error instanceof DOMException &&
        error.name === 'AbortError'
    )

    assert.equal(directory.files.size, 0)
  })
})
