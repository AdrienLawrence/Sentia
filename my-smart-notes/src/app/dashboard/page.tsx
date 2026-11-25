'use client'

import {
  useEffect,
  useRef,
  useState
} from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FeedbackModal } from '@/components/FeedbackModal'
import { TutorialModal } from '@/components/TutorialModal'
import { LegalConsentGate } from '@/features/legal/LegalConsentGate'
import {
  LEGAL_CONSENT_SESSION_KEY
} from '@/features/legal/constants'
import type { User } from '@supabase/supabase-js'
import {
  DEFAULT_NOTEBOOK_NAME_KEY,
  NOTEBOOK_VIEW_KEY,
  PENDING_NOTEBOOK_DELETION_KEY
} from '@/features/dashboard/constants'
import { handleMenuKeyboardNavigation } from '@/features/dashboard/lib/handleMenuKeyboardNavigation'
import { formatNotebookDate } from '@/features/dashboard/lib/formatNotebookDate'
import {
  clearNotebookSessionCache,
  readNotebookSessionCache,
  writeNotebookSessionCache
} from '@/features/dashboard/lib/notebookSessionCache'
import type {
  DashboardNotebook,
  PendingNotebookDeletion
} from '@/features/dashboard/model/types'
import { DashboardSettingsModal } from '@/features/dashboard/components/DashboardSettingsModal'
import { DeleteNotebookModal } from '@/features/dashboard/components/DeleteNotebookModal'
import { DashboardImportControls } from '@/features/dashboard/components/DashboardImportControls'
import {
  isSupportedImportFile,
  MAX_IMPORT_FILES,
  MAX_IMPORT_TOTAL_BYTES,
  notebookNameFromFiles
} from '@/features/file-transfer/lib/content'
import { readImportedFile } from '@/features/file-transfer/lib/fileImport'
import { createNotebookFromImport } from '@/features/file-transfer/lib/importNotebook'
import { NOTEBOOK_REVISION_HEADER } from '@/lib/notebookRevisionShared'
import {
  applyAppTheme,
  readAppTheme,
  saveAppTheme
} from '@/features/theme/appTheme'
import { clearStoredDirectoryHandles } from '@/features/local-mirror/lib/localMarkdownMirror'

type Notebook = DashboardNotebook

function DashboardPageContent() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [deletionError, setDeletionError] = useState<string | null>(null)
  const [activeNotebookMenuId, setActiveNotebookMenuId] =
    useState<string | null>(null)
  const [renamingNotebookId, setRenamingNotebookId] =
    useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [notebookToDelete, setNotebookToDelete] =
    useState<Notebook | null>(null)
  const [isDeletingNotebook, setIsDeletingNotebook] =
    useState(false)
  const [showSettingsModal, setShowSettingsModal] =
    useState(false)
  const [showFeedbackModal, setShowFeedbackModal] =
    useState(false)
  const [showTutorialModal, setShowTutorialModal] =
    useState(false)
  const [defaultNotebookName, setDefaultNotebookName] =
    useState('My Notebook')
  const [listView, setListView] = useState(false)
  const [darkEditorPaper, setDarkEditorPaper] =
    useState(true)
  const [notebookSearch, setNotebookSearch] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(
    null
  )
  const [creationError, setCreationError] = useState<string | null>(
    null
  )
  const [isCreatingNotebook, setIsCreatingNotebook] =
    useState(false)

  const deletionProcessingRef = useRef(false)
  const creationInProgressRef = useRef(false)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const checkUserRef = useRef<() => Promise<void>>(
    async () => undefined
  )
  const initializationStartedRef = useRef(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (initializationStartedRef.current) return
    initializationStartedRef.current = true
    void checkUserRef.current()
  }, [])

  useEffect(() => {
    if (user) router.prefetch('/editor/prefetch')
  }, [router, user])

  useEffect(() => {
    const savedName = localStorage.getItem(
      DEFAULT_NOTEBOOK_NAME_KEY
    )

    if (
      savedName &&
      savedName.trim().length > 0 &&
      savedName.length <= 100
    ) {
      setDefaultNotebookName(savedName)
    }

    setListView(
      localStorage.getItem(NOTEBOOK_VIEW_KEY) === 'true'
    )
    const theme = readAppTheme()
    setDarkEditorPaper(theme === 'dark')
    applyAppTheme(theme)
  }, [])

  const readPendingNotebookDeletion =
    (): PendingNotebookDeletion | null => {
      try {
        const rawValue = sessionStorage.getItem(
          PENDING_NOTEBOOK_DELETION_KEY
        )

        if (!rawValue) {
          return null
        }

        const parsedValue = JSON.parse(rawValue)

        if (
          !parsedValue ||
          typeof parsedValue.notebookId !== 'string' ||
          typeof parsedValue.requestedAt !== 'number'
        ) {
          sessionStorage.removeItem(
            PENDING_NOTEBOOK_DELETION_KEY
          )
          return null
        }

        return parsedValue as PendingNotebookDeletion
      } catch {
        sessionStorage.removeItem(
          PENDING_NOTEBOOK_DELETION_KEY
        )
        return null
      }
    }

  const clearPendingNotebookDeletion = () => {
    sessionStorage.removeItem(
      PENDING_NOTEBOOK_DELETION_KEY
    )
  }

  const checkUser = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)
    const cached = readNotebookSessionCache(user.id)

    if (cached) {
      setNotebooks(cached.notebooks)
      setLoading(false)
    }

    await fetchNotebooks(cached, user.id)
  }

  checkUserRef.current = checkUser

  const finalizeOptimisticNotebookDeletion = async (
    pendingDeletion: PendingNotebookDeletion,
    originalNotebooks: Notebook[]
  ) => {
    if (deletionProcessingRef.current) {
      return
    }

    deletionProcessingRef.current = true

    const deletedNotebookIndex = originalNotebooks.findIndex(
      (notebook) =>
        notebook.id === pendingDeletion.notebookId
    )

    const deletedNotebook =
      deletedNotebookIndex >= 0
        ? originalNotebooks[deletedNotebookIndex]
        : null

    try {
      const response = await fetch(
        `/api/notebooks/${pendingDeletion.notebookId}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok && response.status !== 404) {
        let message = 'Failed to delete notebook.'

        try {
          const body = await response.json()

          if (
            body &&
            typeof body.error === 'string'
          ) {
            message = body.error
          }
        } catch {
          // Keep fallback message for non-JSON responses.
        }

        throw new Error(message)
      }

      clearPendingNotebookDeletion()
    } catch (error) {
      clearPendingNotebookDeletion()

      if (deletedNotebook) {
        setNotebooks((currentNotebooks) => {
          const alreadyRestored = currentNotebooks.some(
            (notebook) =>
              notebook.id === deletedNotebook.id
          )

          if (alreadyRestored) {
            return currentNotebooks
          }

          const restoredNotebooks = [...currentNotebooks]
          const safeIndex = Math.min(
            deletedNotebookIndex,
            restoredNotebooks.length
          )

          restoredNotebooks.splice(
            safeIndex,
            0,
            deletedNotebook
          )

          return restoredNotebooks
        })
      }

      setDeletionError(
        error instanceof Error
          ? error.message
          : 'Failed to delete notebook.'
      )
    } finally {
      deletionProcessingRef.current = false
    }
  }

  const fetchNotebooks = async (
    cached?: {
      etag?: string
      notebooks: Notebook[]
    } | null,
    authenticatedUserId?: string
  ) => {
    try {
      const response = await fetch('/api/notebooks', {
        headers: cached?.etag
          ? {
              'If-None-Match': cached.etag
            }
          : undefined
      })

      if (response.status === 304) {
        return
      }

      if (!response.ok) {
        if (response.status === 401) {
          if (authenticatedUserId) {
            clearNotebookSessionCache(authenticatedUserId)
          }
          router.push('/login')
          return
        }

        throw new Error('Failed to fetch notebooks')
      }

      const fetchedNotebooks: Notebook[] =
        await response.json()

      if (authenticatedUserId) {
        writeNotebookSessionCache(
          authenticatedUserId,
          fetchedNotebooks,
          response.headers.get('etag') ?? undefined
        )
      }

      const pendingDeletion =
        readPendingNotebookDeletion()

      if (!pendingDeletion) {
        setNotebooks(fetchedNotebooks)
        return
      }

      setNotebooks(
        fetchedNotebooks.filter(
          (notebook) =>
            notebook.id !== pendingDeletion.notebookId
        )
      )

      void finalizeOptimisticNotebookDeletion(
        pendingDeletion,
        fetchedNotebooks
      )
    } catch (error) {
      console.error('Error fetching notebooks:', error)
      if (!cached) setNotebooks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || loading) return
    writeNotebookSessionCache(
      user.id,
      notebooks.filter(
        (notebook) => !notebook.id.startsWith('creating-')
      )
    )
  }, [loading, notebooks, user])

  const markNotebookOpenedLocally = (notebookId: string) => {
    const openedAt = new Date().toISOString()
    const updatedNotebooks = notebooks.map((notebook) =>
      notebook.id === notebookId
        ? {
            ...notebook,
            last_opened_at: openedAt
          }
        : notebook
    )

    setNotebooks(updatedNotebooks)
    if (user) {
      writeNotebookSessionCache(user.id, updatedNotebooks)
    }
  }

  const handleCreateNotebook = async () => {
    if (creationInProgressRef.current || !user) return
    creationInProgressRef.current = true

    const temporaryId = `creating-${crypto.randomUUID()}`
    const createdAt = new Date().toISOString()
    const optimisticNotebook: Notebook = {
      id: temporaryId,
      name: defaultNotebookName.trim() || 'My Notebook',
      style: 'standard',
      created_at: createdAt,
      last_opened_at: createdAt,
      revision: 0,
      user_id: user.id,
      latestPageId: null,
      _count: {
        pages: 1
      }
    }
    const previousNotebooks = notebooks
    const optimisticNotebooks = [
      optimisticNotebook,
      ...previousNotebooks
    ]

    setCreationError(null)
    setIsCreatingNotebook(true)
    setNotebooks(optimisticNotebooks)

    try {
      const notebookResponse = await fetch('/api/notebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: defaultNotebookName.trim() || 'My Notebook',
          style: 'standard',
          createInitialPage: true
        })
      })

      if (!notebookResponse.ok) {
        throw new Error(
          `Failed to create notebook: ${notebookResponse.status}`
        )
      }

      const notebook = await notebookResponse.json()
      const reconciledNotebooks = optimisticNotebooks.map(
        (item) =>
          item.id === temporaryId
            ? notebook
            : item
      )

      setNotebooks(reconciledNotebooks)
      writeNotebookSessionCache(user.id, reconciledNotebooks)
      router.push(`/editor/${notebook.initialPageId}`)
    } catch (error) {
      console.error(
        'Error creating notebook:',
        error
      )

      setNotebooks(previousNotebooks)
      writeNotebookSessionCache(user.id, previousNotebooks)
      setCreationError('Could not create the notebook. Please try again.')
    } finally {
      creationInProgressRef.current = false
      setIsCreatingNotebook(false)
    }
  }

  const handleNotebookClick = async (
    notebookId: string
  ) => {
    try {
      const cachedNotebook = notebooks.find(
        (notebook) => notebook.id === notebookId
      )

      if (cachedNotebook?.latestPageId) {
        markNotebookOpenedLocally(notebookId)
        router.push(
          `/editor/${cachedNotebook.latestPageId}`
        )
        return
      }

      let latestPage: { id: string } | null = null

      if (cachedNotebook?.latestPageId === undefined) {
        const response = await fetch(
          `/api/notebooks/${notebookId}/latest-page`
        )

        if (!response.ok) {
          throw new Error(
            'Failed to fetch latest page'
          )
        }

        latestPage = await response.json()
      }

      if (latestPage) {
        markNotebookOpenedLocally(notebookId)
        router.push(`/editor/${latestPage.id}`)
        return
      }

      const newPageResponse = await fetch(
        `/api/notebooks/${notebookId}/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: {
              type: 'doc',
              content: []
            },
            page_number: 1,
            expectedRevision:
              notebooks.find(
                (notebook) => notebook.id === notebookId
              )?.revision ?? 0
          })
        }
      )

      if (!newPageResponse.ok) {
        throw new Error('Failed to create page')
      }

      const newPage =
        await newPageResponse.json()

      markNotebookOpenedLocally(notebookId)
      router.push(`/editor/${newPage.id}`)
    } catch (error) {
      console.error(
        'Error navigating to notebook:',
        error
      )

      alert('Failed to open notebook')
    }
  }

  const handleImportFiles = async (selectedFiles: File[]) => {
    if (isImporting) return

    setImportError(null)

    const validFiles = selectedFiles
      .filter(isSupportedImportFile)
      .sort((left, right) =>
        (
          left.webkitRelativePath || left.name
        ).localeCompare(
          right.webkitRelativePath || right.name,
          undefined,
          { numeric: true, sensitivity: 'base' }
        )
      )

    if (validFiles.length === 0) {
      setImportError(
        'Choose at least one TXT, Markdown, or PDF file.'
      )
      return
    }

    if (validFiles.length > MAX_IMPORT_FILES) {
      setImportError(
        `Import up to ${MAX_IMPORT_FILES} supported files at a time.`
      )
      return
    }

    const totalBytes = validFiles.reduce(
      (total, file) => total + file.size,
      0
    )

    if (totalBytes > MAX_IMPORT_TOTAL_BYTES) {
      setImportError(
        'The selected files must total 50 MB or less.'
      )
      return
    }

    setIsImporting(true)

    try {
      const documents = []

      for (const file of validFiles) {
        documents.push(await readImportedFile(file))
      }

      const firstPageId = await createNotebookFromImport(
        notebookNameFromFiles(validFiles),
        documents
      )

      router.push(`/editor/${firstPageId}`)
    } catch (error) {
      console.error('Failed to import notebook:', error)
      setImportError(
        error instanceof Error
          ? error.message
          : 'Failed to import the selected files.'
      )
    } finally {
      setIsImporting(false)
    }
  }

  const handleRenameNotebook = async (
    event: React.FormEvent,
    notebookId: string
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const name = renameDraft.trim() || 'My Notebook'
    const notebook = notebooks.find(
      (currentNotebook) => currentNotebook.id === notebookId
    )
    if (!notebook) return

    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name,
            expectedRevision: notebook.revision
          })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to rename notebook')
      }
      const nextRevision = Number(
        response.headers.get(NOTEBOOK_REVISION_HEADER)
      )

      setNotebooks((currentNotebooks) =>
        currentNotebooks.map((notebook) =>
          notebook.id === notebookId
            ? {
                ...notebook,
                name,
                revision: Number.isSafeInteger(nextRevision)
                  ? nextRevision
                  : notebook.revision
              }
            : notebook
        )
      )

      setRenamingNotebookId(null)
      setRenameDraft('')
      setRenameError(null)
    } catch (error) {
      console.error('Failed to rename notebook:', error)
      setRenameError('Failed to rename notebook.')
    }
  }

  const handleOpenNotebookInNewTab = async (
    notebookId: string
  ) => {
    const newTab = window.open('about:blank', '_blank')

    if (!newTab) {
      alert('Please allow pop-ups to open the notebook in a new tab.')
      return
    }

    newTab.opener = null

    try {
      const cachedNotebook = notebooks.find(
        (notebook) => notebook.id === notebookId
      )
      let targetPage: { id: string } | null =
        cachedNotebook?.latestPageId
          ? { id: cachedNotebook.latestPageId }
          : null

      if (cachedNotebook?.latestPageId === undefined) {
        const response = await fetch(
          `/api/notebooks/${notebookId}/latest-page`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch latest page')
        }

        targetPage = await response.json()
      }

      if (!targetPage) {
        const newPageResponse = await fetch(
          `/api/notebooks/${notebookId}/pages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: {
                type: 'doc',
                content: []
              },
              page_number: 1,
              expectedRevision:
                notebooks.find(
                  (notebook) => notebook.id === notebookId
                )?.revision ?? 0
            })
          }
        )

        if (!newPageResponse.ok) {
          throw new Error('Failed to create page')
        }

        targetPage = await newPageResponse.json()
      }

      if (!targetPage) {
        throw new Error('Notebook has no available page')
      }

      markNotebookOpenedLocally(notebookId)
      newTab.location.href = new URL(
        `/editor/${targetPage.id}`,
        window.location.origin
      ).toString()
    } catch (error) {
      console.error('Failed to open notebook in new tab:', error)
      newTab.close()
      alert('Failed to open notebook')
    }
  }

  const handleConfirmNotebookDelete = async () => {
    if (!notebookToDelete || isDeletingNotebook) return

    setIsDeletingNotebook(true)
    setDeletionError(null)

    try {
      const response = await fetch(
        `/api/notebooks/${notebookToDelete.id}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete notebook.')
      }

      setNotebooks((currentNotebooks) =>
        currentNotebooks.filter(
          (notebook) => notebook.id !== notebookToDelete.id
        )
      )
      setNotebookToDelete(null)
    } catch (error) {
      console.error('Failed to delete notebook:', error)
      setDeletionError('Failed to delete notebook.')
      setNotebookToDelete(null)
    } finally {
      setIsDeletingNotebook(false)
    }
  }

  const handleLogout = async () => {
    if (user) clearNotebookSessionCache(user.id)
    sessionStorage.removeItem(LEGAL_CONSENT_SESSION_KEY)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      throw new Error('This account does not have an email address.')
    }

    const response = await fetch('/api/account/recovery/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        website: ''
      })
    })
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      throw new Error(
        result?.error || 'A recovery link could not be requested.'
      )
    }
  }

  const handleDeleteAccount = async (confirmation: string) => {
    const response = await fetch('/api/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation })
    })
    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null

    if (!response.ok) {
      throw new Error(result?.error || 'The account could not be deleted.')
    }

    if (user) clearNotebookSessionCache(user.id)

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('sentia:')) localStorage.removeItem(key)
    }

    for (
      let index = sessionStorage.length - 1;
      index >= 0;
      index -= 1
    ) {
      const key = sessionStorage.key(index)
      if (key?.startsWith('sentia:')) sessionStorage.removeItem(key)
    }

    await clearStoredDirectoryHandles().catch((error) => {
      console.warn('Unable to clear local folder settings:', error)
    })
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
    router.replace('/')
    router.refresh()
  }

  const accountProviders = Array.isArray(
    user?.app_metadata?.providers
  )
    ? user.app_metadata.providers.filter(
        (provider): provider is string =>
          typeof provider === 'string'
      )
    : typeof user?.app_metadata?.provider === 'string'
      ? [user.app_metadata.provider]
      : []
  const canResetPassword = accountProviders.includes('email')
  const accountProvider = accountProviders.includes('google')
    ? canResetPassword
      ? 'Google and email/password'
      : 'Google'
    : canResetPassword
      ? 'Email and password'
      : 'Supabase account'

  const normalizedNotebookSearch = notebookSearch
    .trim()
    .toLocaleLowerCase()
  const filteredNotebooks = notebooks.filter((notebook) =>
    notebook.name
      .toLocaleLowerCase()
      .includes(normalizedNotebookSearch)
  )

  if (loading) {
    return (
      <div className="sentia-loading-screen min-h-screen bg-[#080a0e] flex items-center justify-center px-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
            <div className="sentia-loading-card h-14 w-14 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="sentia-loading-spinner h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
            </div>
          </div>

          <h1 className="sentia-loading-title text-lg font-semibold tracking-tight text-white">
            Opening Sentia
          </h1>

          <p className="sentia-loading-copy mt-2 text-sm text-gray-500">
            Loading your notebooks
          </p>

          <div className="mt-5 flex gap-1.5">
            <span className="sentia-loading-dot h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" />

            <span className="sentia-loading-dot h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:150ms]" />

            <span className="sentia-loading-dot h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="sentia-dashboard min-h-screen bg-[#080a0e] text-slate-100"
      onClick={() => {
        if (showDropdown) {
          setShowDropdown(false)
        }

        if (activeNotebookMenuId) {
          setActiveNotebookMenuId(null)
        }
      }}
    >
      <header className="relative z-40 border-b border-slate-800/80 bg-[#0b0e13]/90 backdrop-blur-sm">
        <div className="relative max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="shrink-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              Your Notebooks
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Pick up where you left off.
            </p>
          </div>

          {notebooks.length > 0 && (
            <div className="relative order-3 w-full md:absolute md:left-1/2 md:order-none md:w-[min(40vw,28rem)] md:-translate-x-1/2">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>

              <input
                type="text"
                role="searchbox"
                value={notebookSearch}
                onChange={(event) =>
                  setNotebookSearch(event.target.value)
                }
                placeholder="Search notebooks"
                aria-label="Search notebooks"
                className="w-full rounded-lg border border-slate-800 bg-[#11151c] py-2 pl-10 pr-9 text-sm text-slate-100 outline-none placeholder:text-slate-600 transition-colors focus:border-slate-600"
              />

              {notebookSearch && (
                <button
                  type="button"
                  aria-label="Clear notebook search"
                  onClick={() => setNotebookSearch('')}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className="relative ml-auto">
            <button
              ref={profileButtonRef}
              type="button"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={showDropdown}
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown') return

                event.preventDefault()
                setShowDropdown(true)
                window.requestAnimationFrame(() => {
                  profileMenuRef.current
                    ?.querySelector<HTMLElement>(
                      '[role="menuitem"]'
                    )
                    ?.focus()
                })
              }}
              className="flex items-center space-x-2 text-slate-300 cursor-pointer hover:text-white transition-colors"
            >
              <div className="w-8 h-8 rounded-full border border-slate-600 bg-slate-700 flex items-center justify-center shadow-sm">
                <span className="text-sm font-semibold">
                  {user?.email
                    ?.charAt(0)
                    .toUpperCase()}
                </span>
              </div>
            </button>

            {showDropdown && (
              <div
                ref={profileMenuRef}
                role="menu"
                className="absolute right-0 mt-2 w-48 bg-[#11151c] border border-slate-700 rounded-lg shadow-xl shadow-black/30 py-1 z-50"
                onClick={(e) =>
                  e.stopPropagation()
                }
                onKeyDown={(event) =>
                  handleMenuKeyboardNavigation(event, () => {
                    setShowDropdown(false)
                    profileButtonRef.current?.focus()
                  })
                }
              >
                <div className="px-4 py-2 border-b border-slate-700">
                  <p className="text-sm text-white font-semibold truncate">
                    {user?.email}
                  </p>
                </div>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowDropdown(false)
                    setShowFeedbackModal(true)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Send Feedback
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowDropdown(false)
                    setShowSettingsModal(true)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Settings
                </button>

                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {deletionError && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-900 bg-red-950/70 px-4 py-3 text-sm text-red-200"
          >
            <span>
              {deletionError}
            </span>

            <button
              type="button"
              onClick={() =>
                setDeletionError(null)
              }
              className="shrink-0 rounded px-2 py-1 text-red-100 hover:bg-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {importError && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-amber-900/80 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
          >
            <span>{importError}</span>

            <button
              type="button"
              onClick={() => setImportError(null)}
              className="shrink-0 rounded px-2 py-1 text-amber-100 hover:bg-amber-900/60"
            >
              Dismiss
            </button>
          </div>
        )}

        {creationError && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-red-900 bg-red-950/70 px-4 py-3 text-sm text-red-200"
          >
            <span>{creationError}</span>
            <button
              type="button"
              onClick={() => setCreationError(null)}
              className="shrink-0 rounded px-2 py-1 text-red-100 hover:bg-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {notebooks.length > 0 && (
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCreateNotebook}
                disabled={isImporting || isCreatingNotebook}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-5 py-2 font-medium text-slate-50 shadow-sm cursor-pointer transition-colors hover:bg-slate-600 disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-600 text-base font-light leading-none">
                  +
                </span>
                {isCreatingNotebook
                  ? 'Creating Notebook…'
                  : 'Create New Notebook'}
              </button>

              <DashboardImportControls
                isImporting={isImporting}
                onImport={(files) => void handleImportFiles(files)}
              />

              <button
                type="button"
                onClick={() => router.push('/quiz')}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-[#11151c] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
              >
                Quiz
              </button>
            </div>

            <button
              type="button"
              aria-pressed={listView}
              onClick={() => {
                const nextListView = !listView
                setListView(nextListView)
                localStorage.setItem(
                  NOTEBOOK_VIEW_KEY,
                  String(nextListView)
                )
              }}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-700 bg-[#11151c] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              <span aria-hidden="true">
                {listView ? '▦' : '☷'}
              </span>
              {listView ? 'Card View' : 'List View'}
            </button>
          </div>
        )}

        <div
          className={
            listView
              ? 'grid grid-cols-1 gap-3'
              : 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'
          }
        >
          {filteredNotebooks.map((notebook) => (
            <div
              key={notebook.id}
              role="link"
              tabIndex={
                notebook.id.startsWith('creating-') ? -1 : 0
              }
              aria-disabled={notebook.id.startsWith('creating-')}
              aria-label={`Open ${notebook.name}`}
              className={`sentia-notebook-card group relative overflow-visible rounded-md border border-slate-800 bg-[#11151c] shadow-sm shadow-black/20 cursor-pointer transition-all duration-200 before:absolute before:inset-y-4 before:left-0 before:w-px before:bg-slate-600/60 hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-md hover:shadow-black/20 ${
                listView ? 'min-h-24 p-4' : 'p-6'
              }`}
              onClick={() => {
                if (!notebook.id.startsWith('creating-')) {
                  void handleNotebookClick(notebook.id)
                }
              }}
              onKeyDown={(event) => {
                if (notebook.id.startsWith('creating-')) return

                if (
                  event.target !== event.currentTarget ||
                  !['Enter', ' '].includes(event.key)
                ) {
                  return
                }

                event.preventDefault()
                void handleNotebookClick(notebook.id)
              }}
            >
              {!notebook.id.startsWith('creating-') && <button
                type="button"
                aria-label={`Options for ${notebook.name}`}
                aria-haspopup="menu"
                aria-expanded={
                  activeNotebookMenuId === notebook.id
                }
                aria-controls={`notebook-menu-${notebook.id}`}
                data-notebook-options={notebook.id}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-xl leading-none text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100"
                onClick={(event) => {
                  event.stopPropagation()
                  setShowDropdown(false)
                  setActiveNotebookMenuId(
                    activeNotebookMenuId === notebook.id
                      ? null
                      : notebook.id
                  )
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowDown') return

                  event.preventDefault()
                  event.stopPropagation()
                  setShowDropdown(false)
                  setActiveNotebookMenuId(notebook.id)
                  window.requestAnimationFrame(() => {
                    document
                      .getElementById(
                        `notebook-menu-${notebook.id}`
                      )
                      ?.querySelector<HTMLElement>(
                        '[role="menuitem"]'
                      )
                      ?.focus()
                  })
                }}
              >
                ⋯
              </button>}

              {activeNotebookMenuId === notebook.id && (
                <div
                  id={`notebook-menu-${notebook.id}`}
                  role="menu"
                  className="absolute right-3 top-11 z-30 w-40 rounded-lg border border-slate-700 bg-[#0d1117] py-0.5 shadow-xl shadow-black/30"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) =>
                    handleMenuKeyboardNavigation(event, () => {
                      setActiveNotebookMenuId(null)
                      document
                        .querySelector<HTMLElement>(
                          `[data-notebook-options="${notebook.id}"]`
                        )
                        ?.focus()
                    })
                  }
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setRenamingNotebookId(notebook.id)
                      setRenameDraft(notebook.name)
                      setRenameError(null)
                      setActiveNotebookMenuId(null)
                    }}
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-1.5 text-left text-sm text-red-300 hover:bg-slate-800"
                    onClick={() => {
                      setNotebookToDelete(notebook)
                      setActiveNotebookMenuId(null)
                    }}
                  >
                    Delete
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setActiveNotebookMenuId(null)
                      void handleOpenNotebookInNewTab(notebook.id)
                    }}
                  >
                    Open in new tab
                  </button>
                </div>
              )}

              {renamingNotebookId === notebook.id ? (
                <form
                  className="mb-2 pr-7"
                  onSubmit={(event) =>
                    void handleRenameNotebook(event, notebook.id)
                  }
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    autoFocus
                    aria-label={`Rename ${notebook.name}`}
                    value={renameDraft}
                    maxLength={100}
                    onChange={(event) =>
                      setRenameDraft(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key !== 'Escape') return

                      setRenamingNotebookId(null)
                      setRenameDraft('')
                      setRenameError(null)
                    }}
                    className="w-full rounded border border-slate-600 bg-[#0d1117] px-2 py-1 text-sm text-white outline-none focus:border-slate-400"
                  />

                  <div className="mt-2 flex gap-2">
                    <button
                      type="submit"
                      className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
                      onClick={() => {
                        setRenamingNotebookId(null)
                        setRenameDraft('')
                        setRenameError(null)
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {renameError && (
                    <p className="mt-2 text-xs text-red-300">
                      {renameError}
                    </p>
                  )}
                </form>
              ) : (
                <h3 className="mb-2 pr-7 font-medium tracking-tight text-slate-100">
                  {notebook.name}
                </h3>
              )}

              <p className="text-slate-500 text-sm">
                {notebook.id.startsWith('creating-')
                  ? 'Creating…'
                  : formatNotebookDate(notebook)}
              </p>

              <span className="inline-block mt-3 rounded-md border border-slate-700/70 bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
                {notebook._count.pages}{' '}
                {notebook._count.pages === 1
                  ? 'page'
                  : 'pages'}
              </span>
            </div>
          ))}

          {notebooks.length > 0 && filteredNotebooks.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-800 py-14 text-center">
              <p className="text-sm text-slate-400">
                No notebooks match “{notebookSearch.trim()}”.
              </p>
              <button
                type="button"
                onClick={() => setNotebookSearch('')}
                className="mt-3 text-xs text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}

          {notebooks.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center min-h-[90vh] -mt-16">
              <p className="text-slate-400 text-lg mb-6">
                No notebooks yet
              </p>

              <button
                onClick={handleCreateNotebook}
                disabled={isCreatingNotebook}
                className="rounded-lg border border-slate-600 bg-slate-700 px-8 py-3 text-lg font-medium text-slate-50 shadow-sm cursor-pointer transition-colors hover:bg-slate-600"
              >
                {isCreatingNotebook
                  ? 'Creating Notebook…'
                  : 'Create Your First Notebook'}
              </button>

              <div className="mt-3">
                <DashboardImportControls
                  isImporting={isImporting}
                  onImport={(files) => void handleImportFiles(files)}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {showSettingsModal && (
        <DashboardSettingsModal
          accountProvider={accountProvider}
          canResetPassword={canResetPassword}
          darkEditorPaper={darkEditorPaper}
          defaultNotebookName={defaultNotebookName}
          userEmail={user?.email}
          onClose={() => setShowSettingsModal(false)}
          onDefaultNotebookNameChange={(name) => {
            setDefaultNotebookName(name)
            localStorage.setItem(
              DEFAULT_NOTEBOOK_NAME_KEY,
              name
            )
          }}
          onDeleteAccount={handleDeleteAccount}
          onOpenFeedback={() => {
            setShowSettingsModal(false)
            setShowFeedbackModal(true)
          }}
          onOpenTutorial={() => {
            setShowSettingsModal(false)
            setShowTutorialModal(true)
          }}
          onSendPasswordReset={handleSendPasswordReset}
          onSignOut={() => {
            setShowSettingsModal(false)
            void handleLogout()
          }}
          onThemeChange={(dark) => {
            setDarkEditorPaper(dark)
            saveAppTheme(dark ? 'dark' : 'light')
          }}
        />
      )}

      <FeedbackModal
        isOpen={showFeedbackModal}
        email={user?.email}
        onClose={() => setShowFeedbackModal(false)}
      />

      <TutorialModal
        isOpen={showTutorialModal}
        onClose={() => {
          setShowTutorialModal(false)
          setShowSettingsModal(true)
        }}
      />

      {notebookToDelete && (
        <DeleteNotebookModal
          isDeleting={isDeletingNotebook}
          notebookName={notebookToDelete.name}
          onCancel={() => setNotebookToDelete(null)}
          onConfirm={() => void handleConfirmNotebookDelete()}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <LegalConsentGate>
      <DashboardPageContent />
    </LegalConsentGate>
  )
}
