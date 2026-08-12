import type { NotebookPage } from '@/features/editor/model/types'
import { tiptapDocumentToMarkdown } from '@/features/file-transfer/lib/markdown'

const DATABASE_NAME = 'sentia-local-folders'
const DATABASE_VERSION = 1
const HANDLE_STORE = 'notebook-handles'
const MANIFEST_FILE_NAME = '.sentia.json'

type FilePermissionState = 'denied' | 'granted' | 'prompt'

interface WritableFileStream {
  close: () => Promise<void>
  write: (data: string) => Promise<void>
}

interface LocalFileHandle {
  createWritable: () => Promise<WritableFileStream>
  getFile: () => Promise<File>
}

export interface LocalDirectoryHandle {
  name: string
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<LocalDirectoryHandle>
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<LocalFileHandle>
  queryPermission: (options: {
    mode: 'readwrite'
  }) => Promise<FilePermissionState>
  removeEntry: (name: string) => Promise<void>
  requestPermission: (options: {
    mode: 'readwrite'
  }) => Promise<FilePermissionState>
}

interface MirrorManifest {
  version: 1
  notebookId: string
  notebookName: string
  files: Record<string, string>
  hashes?: Record<string, string>
  signatures?: Record<string, string>
}

interface StoredDirectoryHandle {
  notebookId: string
  handle: LocalDirectoryHandle
}

function openHandleDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION
    )

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(HANDLE_STORE)) {
        database.createObjectStore(HANDLE_STORE, {
          keyPath: 'notebookId'
        })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open local storage.'))
  })
}

async function accessHandleStore<T>(
  mode: IDBTransactionMode,
  operation: (
    store: IDBObjectStore,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void
  ) => void
) {
  const database = await openHandleDatabase()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(HANDLE_STORE, mode)
      operation(
        transaction.objectStore(HANDLE_STORE),
        resolve,
        reject
      )
      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error('Unable to update local folder settings.')
        )
    })
  } finally {
    database.close()
  }
}

export function loadDirectoryHandle(notebookId: string) {
  return accessHandleStore<LocalDirectoryHandle | null>(
    'readonly',
    (store, resolve, reject) => {
      const request = store.get(notebookId)
      request.onsuccess = () => {
        const record = request.result as
          | StoredDirectoryHandle
          | undefined
        resolve(record?.handle ?? null)
      }
      request.onerror = () => reject(request.error)
    }
  )
}

export function storeDirectoryHandle(
  notebookId: string,
  handle: LocalDirectoryHandle
) {
  return accessHandleStore<void>(
    'readwrite',
    (store, resolve, reject) => {
      const request = store.put({ notebookId, handle })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    }
  )
}

export function clearStoredDirectoryHandles() {
  if (typeof indexedDB === 'undefined') return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(
        request.error ??
          new Error('Unable to clear local folder settings.')
      )
    request.onblocked = () => resolve()
  })
}

export function forgetDirectoryHandle(notebookId: string) {
  return accessHandleStore<void>(
    'readwrite',
    (store, resolve, reject) => {
      const request = store.delete(notebookId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    }
  )
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === 'NotFoundError'
  )
}

async function readFileIfPresent(
  directory: LocalDirectoryHandle,
  name: string
) {
  try {
    const handle = await directory.getFileHandle(name)
    return await (await handle.getFile()).text()
  } catch (error) {
    if (isMissingFileError(error)) return null
    throw error
  }
}

async function fileExists(
  directory: LocalDirectoryHandle,
  name: string
) {
  try {
    await directory.getFileHandle(name)
    return true
  } catch (error) {
    if (isMissingFileError(error)) return false
    throw error
  }
}

async function writeFile(
  directory: LocalDirectoryHandle,
  name: string,
  contents: string
) {
  const handle = await directory.getFileHandle(name, {
    create: true
  })
  const writable = await handle.createWritable()

  await writable.write(contents)
  await writable.close()
}

async function contentHash(contents: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(contents)
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function safeMarkdownName(value: string) {
  const cleaned = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 80)

  if (!cleaned) return 'Untitled Page'

  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(
    cleaned
  )
    ? `_${cleaned}`
    : cleaned
}

export function markdownMirrorFileName(page: NotebookPage) {
  const title = safeMarkdownName(
    page.title?.trim() || 'Untitled Page'
  )
  const stableId = page.id.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 8)

  return `${title}--${stableId || 'page'}.md`
}

export function markdownMirrorContents(
  notebookId: string,
  page: NotebookPage
) {
  const title = page.title?.trim() || 'Untitled Page'
  const order =
    typeof page.page_number === 'number' ? page.page_number : 0
  const markdown = tiptapDocumentToMarkdown(page.content)
  const heading = `# ${title}`
  const body = markdown ? `${heading}\n\n${markdown}` : heading

  return [
    '---',
    `sentia_notebook_id: ${JSON.stringify(notebookId)}`,
    `sentia_page_id: ${JSON.stringify(page.id)}`,
    `title: ${JSON.stringify(title)}`,
    `order: ${order}`,
    '---',
    '',
    body,
    ''
  ].join('\n')
}

function pageMirrorSignature(page: NotebookPage) {
  return JSON.stringify([
    page.title?.trim() || 'Untitled Page',
    page.page_number ?? 0,
    page.updated_at ?? null
  ])
}

async function readManifest(
  directory: LocalDirectoryHandle
): Promise<MirrorManifest | null> {
  const contents = await readFileIfPresent(
    directory,
    MANIFEST_FILE_NAME
  )

  if (!contents) return null

  try {
    const parsed = JSON.parse(contents) as Partial<MirrorManifest>

    if (
      parsed.version !== 1 ||
      typeof parsed.notebookId !== 'string' ||
      typeof parsed.notebookName !== 'string' ||
      !parsed.files ||
      typeof parsed.files !== 'object'
    ) {
      throw new Error('The local folder manifest is invalid.')
    }

    return parsed as MirrorManifest
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'The local folder manifest is invalid.'
    ) {
      throw error
    }

    throw new Error('The local folder manifest could not be read.')
  }
}

export async function createConnectedMarkdownDirectory({
  parentDirectory,
  notebookId,
  notebookName
}: {
  parentDirectory: LocalDirectoryHandle
  notebookId: string
  notebookName: string
}) {
  const safeNotebookName = safeMarkdownName(
    notebookName || 'My Notebook'
  )
  const baseName = `Sentia - ${safeNotebookName}`

  for (let suffix = 1; suffix <= 99; suffix += 1) {
    const directoryName =
      suffix === 1 ? baseName : `${baseName} (${suffix})`

    try {
      const existingDirectory =
        await parentDirectory.getDirectoryHandle(directoryName)

      try {
        const manifest = await readManifest(existingDirectory)
        if (manifest?.notebookId === notebookId) {
          return existingDirectory
        }
      } catch {
        // Treat unreadable or invalid existing folders as occupied.
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'TypeMismatchError'
      ) {
        continue
      }

      if (!isMissingFileError(error)) throw error

      return parentDirectory.getDirectoryHandle(directoryName, {
        create: true
      })
    }
  }

  throw new Error(
    `Sentia could not create a dedicated folder for "${safeNotebookName}".`
  )
}

async function chooseAvailableFileName(
  directory: LocalDirectoryHandle,
  desiredName: string,
  pageId: string,
  previousName?: string
) {
  if (desiredName === previousName) return desiredName

  const existing = await readFileIfPresent(directory, desiredName)
  if (
    existing === null ||
    existing.includes(
      `sentia_page_id: ${JSON.stringify(pageId)}`
    )
  ) {
    return desiredName
  }

  const stem = desiredName.replace(/\.md$/i, '')

  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${stem}-${suffix}.md`
    const candidateContents = await readFileIfPresent(
      directory,
      candidate
    )

    if (
      candidateContents === null ||
      candidateContents.includes(
        `sentia_page_id: ${JSON.stringify(pageId)}`
      )
    ) {
      return candidate
    }
  }

  throw new Error(
    `No safe filename is available for "${desiredName}".`
  )
}

async function removeManagedFile(
  directory: LocalDirectoryHandle,
  fileName: string,
  pageId: string
) {
  const contents = await readFileIfPresent(directory, fileName)

  if (
    contents === null ||
    !contents.includes(
      `sentia_page_id: ${JSON.stringify(pageId)}`
    )
  ) {
    return
  }

  try {
    await directory.removeEntry(fileName)
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
}

export async function syncNotebookToDirectory({
  directory,
  notebookId,
  notebookName,
  pages,
  verifyUnchanged = false,
  shouldContinue = () => true
}: {
  directory: LocalDirectoryHandle
  notebookId: string
  notebookName: string
  pages: NotebookPage[]
  verifyUnchanged?: boolean
  shouldContinue?: () => boolean
}) {
  const assertActive = () => {
    if (!shouldContinue()) {
      throw new DOMException('Sync cancelled', 'AbortError')
    }
  }

  assertActive()
  const manifest = await readManifest(directory)

  if (manifest && manifest.notebookId !== notebookId) {
    throw new Error(
      'This folder is already connected to a different Sentia notebook.'
    )
  }

  const previousFiles = manifest?.files ?? {}
  const previousHashes = manifest?.hashes ?? {}
  const previousSignatures = manifest?.signatures ?? {}
  const nextFiles: Record<string, string> = {}
  const nextHashes: Record<string, string> = {}
  const nextSignatures: Record<string, string> = {}
  const savedPages = pages.filter((page) => !page.isPendingCreation)

  for (const page of savedPages) {
    assertActive()
    const signature = pageMirrorSignature(page)
    const fileName = await chooseAvailableFileName(
      directory,
      markdownMirrorFileName(page),
      page.id,
      previousFiles[page.id]
    )
    const unchanged =
      previousFiles[page.id] === fileName &&
      previousSignatures[page.id] === signature

    if (
      unchanged &&
      (!verifyUnchanged ||
        (await fileExists(directory, fileName)))
    ) {
      nextFiles[page.id] = fileName
      nextHashes[page.id] = previousHashes[page.id] ?? ''
      nextSignatures[page.id] = signature
      continue
    }

    const contents = markdownMirrorContents(notebookId, page)
    const hash = await contentHash(contents)
    const existingContents =
      previousFiles[page.id] === fileName &&
      previousHashes[page.id] === hash
        ? await readFileIfPresent(directory, fileName)
        : null

    assertActive()
    if (
      existingContents === null ||
      (await contentHash(existingContents)) !== hash
    ) {
      await writeFile(directory, fileName, contents)
    }
    nextFiles[page.id] = fileName
    nextHashes[page.id] = hash
    nextSignatures[page.id] = signature
  }

  for (const [pageId, previousName] of Object.entries(
    previousFiles
  )) {
    assertActive()
    if (nextFiles[pageId] === previousName) continue
    await removeManagedFile(directory, previousName, pageId)
  }

  const nextManifest: MirrorManifest = {
    version: 1,
    notebookId,
    notebookName: notebookName || 'My Notebook',
    files: nextFiles,
    hashes: nextHashes,
    signatures: nextSignatures
  }

  assertActive()
  await writeFile(
    directory,
    MANIFEST_FILE_NAME,
    `${JSON.stringify(nextManifest, null, 2)}\n`
  )
}
