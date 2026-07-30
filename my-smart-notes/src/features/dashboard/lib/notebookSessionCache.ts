import type { DashboardNotebook } from '../model/types'

const CACHE_VERSION = 2
const CACHE_PREFIX = 'sentia:dashboard-notebooks:'

interface NotebookCachePayload {
  version: number
  savedAt: number
  etag?: string
  notebooks: DashboardNotebook[]
}

export function readNotebookSessionCache(userId: string) {
  if (typeof sessionStorage === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${userId}`)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<NotebookCachePayload>

    if (
      parsed.version !== CACHE_VERSION ||
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.notebooks) ||
      parsed.notebooks.some(
        (notebook) =>
          !notebook ||
          typeof notebook.id !== 'string' ||
          typeof notebook.name !== 'string' ||
          typeof notebook.revision !== 'number'
      )
    ) {
      clearNotebookSessionCache(userId)
      return null
    }

    return {
      etag:
        typeof parsed.etag === 'string'
          ? parsed.etag
          : undefined,
      savedAt: parsed.savedAt,
      notebooks: parsed.notebooks as DashboardNotebook[]
    }
  } catch {
    clearNotebookSessionCache(userId)
    return null
  }
}

export function writeNotebookSessionCache(
  userId: string,
  notebooks: DashboardNotebook[],
  etag?: string
) {
  if (typeof sessionStorage === 'undefined') return

  const existingEtag =
    etag ?? readNotebookSessionCache(userId)?.etag

  const payload: NotebookCachePayload = {
    version: CACHE_VERSION,
    savedAt: Date.now(),
    etag: existingEtag,
    notebooks
  }

  sessionStorage.setItem(
    `${CACHE_PREFIX}${userId}`,
    JSON.stringify(payload)
  )
}

export function clearNotebookSessionCache(userId: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(`${CACHE_PREFIX}${userId}`)
}

export function markNotebookOpenedInSessionCache(
  userId: string,
  notebookId: string,
  openedAt: string,
  latestPageId?: string
) {
  const cached = readNotebookSessionCache(userId)
  if (!cached) return

  writeNotebookSessionCache(
    userId,
    cached.notebooks.map((notebook) =>
      notebook.id === notebookId
        ? {
            ...notebook,
            last_opened_at: openedAt,
            latestPageId:
              latestPageId ?? notebook.latestPageId
          }
        : notebook
    )
  )
}
