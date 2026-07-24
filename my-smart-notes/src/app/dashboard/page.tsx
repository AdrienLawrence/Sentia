'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FeedbackModal } from '@/components/FeedbackModal'
import { TutorialModal } from '@/components/TutorialModal'

interface Notebook {
  id: string
  name: string
  style: string
  created_at: string
  last_opened_at?: string | null
  user_id: string
  _count: {
    pages: number
  }
}

interface PendingNotebookDeletion {
  notebookId: string
  requestedAt: number
}

const PENDING_NOTEBOOK_DELETION_KEY =
  'scribeai:pendingNotebookDeletion'
const DEFAULT_NOTEBOOK_NAME_KEY =
  'scribeai:defaultNotebookName'
const NOTEBOOK_VIEW_KEY = 'scribeai:notebookListView'
const EDITOR_PAPER_THEME_KEY = 'scribeai:editorPaperTheme'

const formatNotebookDate = (notebook: Notebook) => {
  const today = new Date()
  const lastOpened = notebook.last_opened_at
    ? new Date(notebook.last_opened_at)
    : null
  const formatDate = (date: Date) =>
    date.toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year:
        date.getFullYear() === today.getFullYear()
          ? undefined
          : 'numeric'
    })

  if (lastOpened) {
    const openedToday =
      lastOpened.getFullYear() === today.getFullYear() &&
      lastOpened.getMonth() === today.getMonth() &&
      lastOpened.getDate() === today.getDate()

    if (openedToday) {
      return `Opened ${lastOpened.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      })}`
    }

    return `Opened ${formatDate(lastOpened)}`
  }

  return `Created ${formatDate(new Date(notebook.created_at))}`
}

export default function DashboardPage() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
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
    useState(false)
  const [notebookSearch, setNotebookSearch] = useState('')

  const deletionProcessingRef = useRef(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void checkUser()
  }, [])

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
    setDarkEditorPaper(
      localStorage.getItem(EDITOR_PAPER_THEME_KEY) === 'dark'
    )
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
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setUser(user)
    await fetchNotebooks()
  }

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

  const fetchNotebooks = async () => {
    try {
      const response = await fetch('/api/notebooks')

      if (!response.ok) {
        throw new Error('Failed to fetch notebooks')
      }

      const fetchedNotebooks: Notebook[] =
        await response.json()

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
      setNotebooks([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNotebook = async () => {
    try {
      const notebookResponse = await fetch('/api/notebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: defaultNotebookName.trim() || 'My Notebook',
          style: 'standard'
        })
      })

      if (!notebookResponse.ok) {
        throw new Error(
          `Failed to create notebook: ${notebookResponse.status}`
        )
      }

      const notebook = await notebookResponse.json()

      const pageResponse = await fetch(
        `/api/notebooks/${notebook.id}/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Page 1',
            content: {
              type: 'doc',
              content: []
            },
            page_number: 1
          })
        }
      )

      if (!pageResponse.ok) {
        throw new Error(
          'Failed to create first page'
        )
      }

      const page = await pageResponse.json()

      router.push(`/editor/${page.id}`)
    } catch (error) {
      console.error(
        'Error creating notebook:',
        error
      )

      alert(
        'Failed to create notebook. Check console for details.'
      )
    }
  }

  const handleNotebookClick = async (
    notebookId: string
  ) => {
    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}/latest-page`
      )

      if (!response.ok) {
        throw new Error(
          'Failed to fetch latest page'
        )
      }

      const latestPage = await response.json()

      if (latestPage) {
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
            title: 'Page 1',
            content: {
              type: 'doc',
              content: []
            },
            page_number: 1
          })
        }
      )

      if (!newPageResponse.ok) {
        throw new Error('Failed to create page')
      }

      const newPage =
        await newPageResponse.json()

      router.push(`/editor/${newPage.id}`)
    } catch (error) {
      console.error(
        'Error navigating to notebook:',
        error
      )

      alert('Failed to open notebook')
    }
  }

  const handleRenameNotebook = async (
    event: React.FormEvent,
    notebookId: string
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const name = renameDraft.trim() || 'My Notebook'

    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to rename notebook')
      }

      setNotebooks((currentNotebooks) =>
        currentNotebooks.map((notebook) =>
          notebook.id === notebookId
            ? {
                ...notebook,
                name
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
      const response = await fetch(
        `/api/notebooks/${notebookId}/latest-page`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch latest page')
      }

      let targetPage = await response.json()

      if (!targetPage) {
        const newPageResponse = await fetch(
          `/api/notebooks/${notebookId}/pages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: 'Page 1',
              content: {
                type: 'doc',
                content: []
              },
              page_number: 1
            })
          }
        )

        if (!newPageResponse.ok) {
          throw new Error('Failed to create page')
        }

        targetPage = await newPageResponse.json()
      }

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
    await supabase.auth.signOut()
    router.push('/login')
  }

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
      <div className="min-h-screen bg-[#080a0e] flex items-center justify-center px-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
            <div className="h-14 w-14 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
            </div>
          </div>

          <h1 className="text-lg font-semibold tracking-tight text-white">
            Opening ScribeAI
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Loading your notebooks
          </p>

          <div className="mt-5 flex gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500" />

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:150ms]" />

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-500 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-[#080a0e] text-slate-100"
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
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
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
                className="absolute right-0 mt-2 w-48 bg-[#11151c] border border-slate-700 rounded-lg shadow-xl shadow-black/30 py-1 z-50"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <div className="px-4 py-2 border-b border-slate-700">
                  <p className="text-sm text-white font-semibold truncate">
                    {user?.email}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowDropdown(false)
                    setShowFeedbackModal(true)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Send Feedback
                </button>

                <button
                  onClick={() => {
                    setShowDropdown(false)
                    setShowSettingsModal(true)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer transition-colors duration-200"
                >
                  Settings
                </button>

                <button
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

        {notebooks.length > 0 && (
          <div className="mb-8 flex items-center justify-between gap-4">
            <button
              onClick={handleCreateNotebook}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-5 py-2 font-medium text-slate-50 shadow-sm cursor-pointer transition-colors hover:bg-slate-600"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-600 text-base font-light leading-none">
                +
              </span>
              Create New Notebook
            </button>

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
              className={`group relative overflow-visible rounded-xl border border-slate-800 bg-[#11151c] shadow-sm shadow-black/20 cursor-pointer transition-all duration-200 before:absolute before:inset-y-4 before:left-0 before:w-px before:bg-slate-600/60 hover:-translate-y-0.5 hover:border-slate-600 hover:shadow-lg hover:shadow-black/25 ${
                listView ? 'min-h-24 p-4' : 'p-6'
              }`}
              onClick={() =>
                handleNotebookClick(notebook.id)
              }
            >
              <button
                type="button"
                aria-label={`Options for ${notebook.name}`}
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
              >
                ⋯
              </button>

              {activeNotebookMenuId === notebook.id && (
                <div
                  className="absolute right-3 top-11 z-30 w-40 rounded-lg border border-slate-700 bg-[#0d1117] py-0.5 shadow-xl shadow-black/30"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
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
                    value={renameDraft}
                    maxLength={100}
                    onChange={(event) =>
                      setRenameDraft(event.target.value)
                    }
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
                {formatNotebookDate(notebook)}
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
                className="rounded-lg border border-slate-600 bg-slate-700 px-8 py-3 text-lg font-medium text-slate-50 shadow-sm cursor-pointer transition-colors hover:bg-slate-600"
              >
                Create Your First Notebook
              </button>
            </div>
          )}
        </div>
      </main>

      {showSettingsModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowSettingsModal(false)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-settings-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-[#11151c] p-6 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-6 border-b border-slate-800 pb-4">
              <div>
                <h2
                  id="dashboard-settings-title"
                  className="text-lg font-semibold tracking-tight text-slate-50"
                >
                  Settings
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dashboard and notebook preferences.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setShowSettingsModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                ×
              </button>
            </div>

            <div className="divide-y divide-slate-800">
              <section className="py-5">
                <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-4">
                  <div className="flex items-center justify-between gap-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-medium uppercase tracking-wider text-sky-300">
                          Tutorial
                        </h3>
                        <span className="rounded border border-sky-800/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-400">
                          Essential
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-100">
                        Learn every ScribeAI workflow
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        A complete guided tour of notebooks, pages, editing, commands, recovery, and account tools.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSettingsModal(false)
                        setShowTutorialModal(true)
                      }}
                      className="shrink-0 rounded-md border border-sky-800/70 bg-sky-950/40 px-3 py-2 text-sm text-sky-200 transition-colors hover:bg-sky-900/40 hover:text-sky-100"
                    >
                      Start
                    </button>
                  </div>
                </div>
              </section>

              <section className="py-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Account
                </h3>

                <div className="mt-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-300">
                      Signed in as
                    </p>
                    <p className="truncate text-sm font-medium text-slate-100">
                      {user?.email}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(false)
                      void handleLogout()
                    }}
                    className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    Sign Out
                  </button>
                </div>
              </section>

              <section className="py-5">
                <label
                  htmlFor="default-notebook-name"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  New Notebooks
                </label>

                <div className="mt-3 flex items-center justify-between gap-5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Default notebook name
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Used as the starting name for new notebooks.
                    </p>
                  </div>

                  <input
                    id="default-notebook-name"
                    type="text"
                    value={defaultNotebookName}
                    maxLength={100}
                    onChange={(event) => {
                      const nextName = event.target.value
                      setDefaultNotebookName(nextName)
                      localStorage.setItem(
                        DEFAULT_NOTEBOOK_NAME_KEY,
                        nextName
                      )
                    }}
                    className="w-44 rounded-md border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
                  />
                </div>
              </section>

              <section className="py-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Editor Paper
                </h3>

                <div className="mt-3 flex items-center justify-between gap-5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Writing surface
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Choose a light or VS Code-style dark page.
                    </p>
                  </div>

                  <div
                    role="radiogroup"
                    aria-label="Editor paper theme"
                    className="flex shrink-0 rounded-md border border-slate-700 bg-[#0d1117] p-1"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!darkEditorPaper}
                      onClick={() => {
                        setDarkEditorPaper(false)
                        localStorage.setItem(
                          EDITOR_PAPER_THEME_KEY,
                          'light'
                        )
                      }}
                      className={`rounded px-3 py-1.5 text-xs transition-colors ${
                        !darkEditorPaper
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Light
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={darkEditorPaper}
                      onClick={() => {
                        setDarkEditorPaper(true)
                        localStorage.setItem(
                          EDITOR_PAPER_THEME_KEY,
                          'dark'
                        )
                      }}
                      className={`rounded px-3 py-1.5 text-xs transition-colors ${
                        darkEditorPaper
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </section>

              <section className="py-5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Feedback &amp; Support
                </h3>

                <div className="mt-3 flex items-center justify-between gap-5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Help improve ScribeAI
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Report bugs, suggest ideas, and track your submissions.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSettingsModal(false)
                      setShowFeedbackModal(true)
                    }}
                    className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    Open Feedback
                  </button>
                </div>
              </section>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isDeletingNotebook
            ) {
              setNotebookToDelete(null)
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dashboard-notebook-title"
            aria-describedby="delete-dashboard-notebook-description"
            className="w-full max-w-md rounded-xl border border-slate-700 bg-[#11151c] p-6 shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="delete-dashboard-notebook-title"
              className="text-xl font-bold text-gray-50"
            >
              Delete Notebook
            </h2>

            <p
              id="delete-dashboard-notebook-description"
              className="mt-3 leading-6 text-gray-300"
            >
              Delete “{notebookToDelete.name}”? This cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDeletingNotebook}
                onClick={() => setNotebookToDelete(null)}
                className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                autoFocus
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingNotebook}
                onClick={() => void handleConfirmNotebookDelete()}
                className="rounded-lg border border-red-900 bg-red-950 px-4 py-2 text-red-200 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingNotebook ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
