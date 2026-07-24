'use client'

import styles from './Editor.module.css'
import { TiptapEditor } from '@/components/TiptapEditor'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEditorStore } from '@/components/editor/useEditorStore'
import { TutorialModal } from '@/components/TutorialModal'
import { EditorShowcaseTour } from '@/components/EditorShowcaseTour'

interface DrawBox {
  id: string
  x_position: number
  y_position: number
  width: number
  height: number
  elements?: Array<any>
}

interface Notebook {
  id: string
  name: string
  style: string
}

interface Page {
  id: string
  user_id?: string
  editorKey?: string
  title?: string
  page_number?: number
  content?: any
  notebook?: Notebook
  notebook_id?: string
  draw_boxes?: DrawBox[]
  isPendingCreation?: boolean
}

interface DeletedPageEntry {
  page: Page
  originalIndex: number
}

interface AiCitation {
  number: number
  pageId: string
  pageTitle: string
  excerpt: string
}

interface AiExternalCitation {
  url: string
  title: string
  startIndex: number
  endIndex: number
}

interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  action?: AiAction
  target?: AiTarget
  selection?: AiSelectionSnapshot
  notebookCitations?: AiCitation[]
  externalCitations?: AiExternalCitation[]
  usedExternalResearch?: boolean
}

interface AiInsertRequest {
  id: string
  text: string
}

interface AiSelectionSnapshot {
  from: number
  to: number
  text: string
}

interface AiReplaceRequest {
  id: string
  sourceMessageId: string
  target: AiTarget
  text: string
  selection?: AiSelectionSnapshot
}

type AiAction =
  | 'explain'
  | 'check'
  | 'rewrite'
  | 'summarize'
  | 'ask'
type AiTarget = 'page' | 'selection'

function cleanChatFormatting(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/`{1,3}/g, '')
}

function renderAiMessageText(message: AiMessage) {
  const citations = [...(message.externalCitations ?? [])]
    .filter(
      (citation) =>
        citation.startIndex >= 0 &&
        citation.endIndex > citation.startIndex &&
        citation.endIndex <= message.text.length
    )
    .sort((left, right) => left.startIndex - right.startIndex)
  const parts: React.ReactNode[] = []
  let cursor = 0

  citations.forEach((citation, index) => {
    if (citation.startIndex < cursor) return

    parts.push(
      cleanChatFormatting(
        message.text.slice(cursor, citation.startIndex)
      )
    )
    parts.push(
      <a
        key={`${citation.url}-${index}`}
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        title={citation.title}
      >
        {cleanChatFormatting(
          message.text.slice(
            citation.startIndex,
            citation.endIndex
          )
        )}
      </a>
    )
    cursor = citation.endIndex
  })

  parts.push(cleanChatFormatting(message.text.slice(cursor)))
  return parts
}

const PENDING_NOTEBOOK_DELETION_KEY =
  'scribeai:pendingNotebookDeletion'
const EDITOR_PAPER_THEME_KEY = 'scribeai:editorPaperTheme'
const EDITOR_TOUR_COMPLETED_KEY =
  'scribeai:editorTourCompleted:v1'

export default function EditorPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'read' | 'write'>('write')
  const [pages, setPages] = useState<Page[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selectedReadPageId, setSelectedReadPageId] =
    useState<string | null>(null)
  const [isTitleFocused, setIsTitleFocused] = useState(false)
  const [draggedPageId, setDraggedPageId] =
    useState<string | null>(null)
  const [dragOverPageId, setDragOverPageId] =
    useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] =
    useState<'before' | 'after' | null>(null)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTutorialModal, setShowTutorialModal] = useState(false)
  const [showEditorTour, setShowEditorTour] = useState(true)
  const [darkEditorPaper, setDarkEditorPaper] =
    useState(false)
  const [fontSizeInput, setFontSizeInput] = useState('16')
  const [isFontSizeInputFocused, setIsFontSizeInputFocused] =
    useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiMessages, setAiMessages] =
    useState<AiMessage[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [isAskingAi, setIsAskingAi] = useState(false)
  const [aiInsertRequest, setAiInsertRequest] =
    useState<AiInsertRequest | null>(null)
  const [addedAiMessageIds, setAddedAiMessageIds] =
    useState<string[]>([])
  const [aiSelection, setAiSelection] =
    useState<AiSelectionSnapshot | null>(null)
  const [aiTarget, setAiTarget] =
    useState<AiTarget>('page')
  const [aiReplaceRequest, setAiReplaceRequest] =
    useState<AiReplaceRequest | null>(null)
  const [replacedAiMessageIds, setReplacedAiMessageIds] =
    useState<string[]>([])
  const [pendingPageReplaceId, setPendingPageReplaceId] =
    useState<string | null>(null)

  const editorContainerRef = useRef<HTMLDivElement>(null)
  const notebookNameInputRef = useRef<HTMLInputElement>(null)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const aiMessagesEndRef = useRef<HTMLDivElement>(null)
  const contentSaveTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const notebookNameSaveTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string | null>(null)
  const lastSavedNotebookNameRef = useRef<string | null>(null)
  const pendingContentRef = useRef<any>(null)
  const isCreatingPageRef = useRef(false)
  const pendingCreatedPageRef = useRef<Page | null>(null)
  const deleteSurfaceActiveRef = useRef(false)
  const deletedPagesStackRef = useRef<DeletedPageEntry[]>([])
  const activePageIdRef = useRef<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    setDarkEditorPaper(
      localStorage.getItem(EDITOR_PAPER_THEME_KEY) === 'dark'
    )
  }, [])

  useEffect(() => {
    if (!page?.user_id) return

    setShowEditorTour(
      localStorage.getItem(
        `${EDITOR_TOUR_COMPLETED_KEY}:${page.user_id}`
      ) !== 'true'
    )
  }, [page?.user_id])

  const {
    isBold,
    isItalic,
    isStrikethrough,
    isBulletList,
    isOrderedList,
    textColor,
    alignment,
    fontSize,
    fontFamily,

    setBold,
    setItalic,
    setStrikethrough,
    setBulletList,
    setOrderedList,
    setTextColor,
    setAlignment,
    setFontSize
  } = useEditorStore()

  useEffect(() => {
    if (!isFontSizeInputFocused) {
      setFontSizeInput(fontSize.replace('px', ''))
    }
  }, [fontSize, isFontSizeInputFocused])

  useEffect(() => {
    if (!showAiPanel) return

    aiMessagesEndRef.current?.scrollIntoView({
      block: 'end'
    })
  }, [aiMessages, isAskingAi, showAiPanel])

  const flushPendingDeletedPagesOnExit = () => {
    const pendingDeletions = [
      ...deletedPagesStackRef.current
    ]

    deletedPagesStackRef.current = []

    pendingDeletions.forEach((entry) => {
      void fetch(`/api/pages/${entry.page.id}`, {
        method: 'DELETE',
        keepalive: true
      }).catch((error) => {
        console.error(
          'Failed to delete page while leaving editor:',
          error
        )
      })
    })
  }

  useEffect(() => {
    async function loadPage() {
      try {
        const { id } = await params

        const pageResponse = await fetch(`/api/pages/${id}`)

        if (!pageResponse.ok) {
          throw new Error(`Failed to load page: ${pageResponse.status}`)
        }

        const pageData = await pageResponse.json()

        lastSavedContentRef.current = JSON.stringify(
          pageData.content ?? null
        )
        lastSavedNotebookNameRef.current =
          pageData.notebook?.name ?? null
        pendingContentRef.current = null
        activePageIdRef.current = pageData.id
        setPage(pageData)
        setSelectedReadPageId(pageData.id)

        if (pageData.notebook || pageData.notebook_id) {
          const notebookId =
            pageData.notebook?.id || pageData.notebook_id

          void fetch(`/api/notebooks/${notebookId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ markOpened: true })
          }).catch((openError) => {
            console.error(
              'Failed to record notebook activity:',
              openError
            )
          })

          try {
            const pagesResponse = await fetch(
              `/api/notebooks/${notebookId}/pages`
            )

            if (pagesResponse.ok) {
              const allPages = await pagesResponse.json()

              setPages(allPages || [])
            } else {
              console.log(
                'No pages found or API error, using empty array'
              )
              setPages([])
            }
          } catch (pagesError) {
            console.log(
              'Error fetching pages, using empty array:',
              pagesError
            )
            setPages([])
          }
        }

        setLoading(false)
      } catch (error) {
        console.error('Error loading page:', error)
        setError('Failed to load page')
        setLoading(false)
      }
    }

    loadPage()
    window.addEventListener(
      'pagehide',
      flushPendingDeletedPagesOnExit
    )

    return () => {
      window.removeEventListener(
        'pagehide',
        flushPendingDeletedPagesOnExit
      )

      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current)
        contentSaveTimeoutRef.current = null
      }

      if (notebookNameSaveTimeoutRef.current) {
        clearTimeout(notebookNameSaveTimeoutRef.current)
        notebookNameSaveTimeoutRef.current = null
      }

      flushPendingDeletedPagesOnExit()
    }
  }, [params])

  useEffect(() => {
    if (!showFileMenu) return

    const handleFileMenuPointerDown = (
      event: PointerEvent
    ) => {
      const target = event.target

      if (
        target instanceof Node &&
        !fileMenuRef.current?.contains(target)
      ) {
        setShowFileMenu(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handleFileMenuPointerDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleFileMenuPointerDown
      )
    }
  }, [showFileMenu])

  const saveContentNow = async (pageId: string) => {
    if (contentSaveTimeoutRef.current) {
      clearTimeout(contentSaveTimeoutRef.current)
      contentSaveTimeoutRef.current = null
    }

    const pendingContent = pendingContentRef.current

    if (pendingContent === null) {
      return true
    }

    const serializedContent = JSON.stringify(pendingContent)

    if (serializedContent === lastSavedContentRef.current) {
      pendingContentRef.current = null
      return true
    }

    try {
      const response = await fetch(`/api/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: pendingContent
        })
      })

      if (!response.ok) {
        throw new Error(
          `Failed to save page content: ${response.status}`
        )
      }

      lastSavedContentRef.current = serializedContent

      if (
        pendingContentRef.current !== null &&
        JSON.stringify(pendingContentRef.current) === serializedContent
      ) {
        pendingContentRef.current = null
      }

      setPages((currentPages) =>
        currentPages.map((currentPage) =>
          currentPage.id === pageId
            ? {
                ...currentPage,
                content: pendingContent
              }
            : currentPage
        )
      )

      return true
    } catch (error) {
      console.error('Failed to save page content:', error)
      return false
    }
  }

  const openPageInPlace = (
    targetPage: Page,
    historyMode: 'push' | 'replace' = 'push'
  ) => {
    lastSavedContentRef.current = JSON.stringify(
      targetPage.content ?? null
    )
    pendingContentRef.current = null
    activePageIdRef.current = targetPage.id

    setPage(targetPage)
    setSelectedReadPageId(targetPage.id)
    setIsTitleFocused(false)
    setShowAiPanel(false)
    setAiMessages([])
    setAiError(null)
    setAiInsertRequest(null)
    setAddedAiMessageIds([])
    setAiSelection(null)
    setAiTarget('page')
    setAiReplaceRequest(null)
    setReplacedAiMessageIds([])
    setPendingPageReplaceId(null)

    if (targetPage.isPendingCreation) {
      return
    }

    const nextUrl = `/editor/${targetPage.id}`

    if (historyMode === 'replace') {
      window.history.replaceState({}, '', nextUrl)
      return
    }

    window.history.pushState({}, '', nextUrl)
  }

  const handlePageTitleFocus = (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    setIsTitleFocused(true)

    if (
      e.currentTarget.value.trim().toLowerCase() ===
      'untitled page'
    ) {
      e.currentTarget.select()
    }
  }

  const setNotebookNameLocally = (name: string) => {
    const notebookId =
      page?.notebook?.id || page?.notebook_id

    setPage((currentPage) =>
      currentPage?.notebook
        ? {
            ...currentPage,
            notebook: {
              ...currentPage.notebook,
              name
            }
          }
        : currentPage
    )

    setPages((currentPages) =>
      currentPages.map((currentPage) =>
        currentPage.notebook &&
        currentPage.notebook.id === notebookId
          ? {
              ...currentPage,
              notebook: {
                ...currentPage.notebook,
                name
              }
            }
          : currentPage
      )
    )
  }

  const saveNotebookNameNow = async (
    notebookId: string,
    name: string
  ) => {
    if (notebookNameSaveTimeoutRef.current) {
      clearTimeout(notebookNameSaveTimeoutRef.current)
      notebookNameSaveTimeoutRef.current = null
    }

    if (name === lastSavedNotebookNameRef.current) {
      return
    }

    try {
      const response = await fetch(`/api/notebooks/${notebookId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      })

      if (!response.ok) {
        throw new Error(
          `Failed to save notebook name: ${response.status}`
        )
      }

      lastSavedNotebookNameRef.current = name
    } catch (error) {
      console.error('Failed to save notebook name:', error)
    }
  }

  const handleNotebookNameChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const notebookId =
      page?.notebook?.id || page?.notebook_id
    const name = e.target.value

    setNotebookNameLocally(name)

    if (!notebookId) return

    if (notebookNameSaveTimeoutRef.current) {
      clearTimeout(notebookNameSaveTimeoutRef.current)
    }

    notebookNameSaveTimeoutRef.current = setTimeout(() => {
      void saveNotebookNameNow(
        notebookId,
        name.trim() || 'My Notebook'
      )
    }, 750)
  }

  const handleNotebookNameBlur = (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    if (!page) return

    const notebookId =
      page.notebook?.id || page.notebook_id

    if (!notebookId) return

    const name =
      e.currentTarget.value.trim() || 'My Notebook'

    setNotebookNameLocally(name)
    void saveNotebookNameNow(notebookId, name)
  }

  const handlePageTitleBlur = (
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    setIsTitleFocused(false)

    if (!page) return

    if (e.currentTarget.value.trim().length === 0) {
      const fallbackTitle = 'Untitled Page'

      setPage((currentPage) =>
        currentPage
          ? {
              ...currentPage,
              title: fallbackTitle
            }
          : currentPage
      )

      setPages((currentPages) =>
        currentPages.map((currentPage) =>
          currentPage.id === page.id
            ? {
                ...currentPage,
                title: fallbackTitle
              }
            : currentPage
        )
      )

      if (page.isPendingCreation) {
        pendingCreatedPageRef.current = {
          ...(pendingCreatedPageRef.current || page),
          title: fallbackTitle
        }

        return
      }

      void fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: fallbackTitle
        })
      })
    }
  }

  const handlePageTitleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!page) return

    const newTitle = e.target.value

    setPage((currentPage) =>
      currentPage
        ? {
            ...currentPage,
            title: newTitle
          }
        : currentPage
    )

    setPages((currentPages) =>
      currentPages.map((currentPage) =>
        currentPage.id === page.id
          ? {
              ...currentPage,
              title: newTitle
            }
          : currentPage
      )
    )

    if (page.isPendingCreation) {
      pendingCreatedPageRef.current = {
        ...(pendingCreatedPageRef.current || page),
        title: newTitle
      }

      return
    }

    fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: newTitle
      })
    })
  }

  const handlePageClick = async (pageId: string) => {
    setSelectedReadPageId(pageId)

    if (!page || pageId === page.id) return

    const targetPage = pages.find(
      (currentPage) => currentPage.id === pageId
    )

    if (!targetPage) return

    const saved = await saveContentNow(page.id)

    if (saved) {
      openPageInPlace(targetPage)
    }
  }

  const handlePageDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    pageId: string
  ) => {
    setDraggedPageId(pageId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', pageId)
  }

  const handlePageDragOver = (
    event: React.DragEvent<HTMLButtonElement>,
    pageId: string
  ) => {
    event.preventDefault()

    if (!draggedPageId || draggedPageId === pageId) {
      setDragOverPageId(null)
      setDragOverPosition(null)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const position =
      event.clientY < bounds.top + bounds.height / 2
        ? 'before'
        : 'after'

    event.dataTransfer.dropEffect = 'move'
    setDragOverPageId(pageId)
    setDragOverPosition(position)
  }

  const clearPageDragState = () => {
    setDraggedPageId(null)
    setDragOverPageId(null)
    setDragOverPosition(null)
  }

  const handlePageDrop = async (
    event: React.DragEvent<HTMLButtonElement>,
    targetPageId: string
  ) => {
    event.preventDefault()
    event.stopPropagation()

    if (
      !draggedPageId ||
      draggedPageId === targetPageId ||
      !dragOverPosition
    ) {
      clearPageDragState()
      return
    }

    const originalPages = pages
    const reorderedPages = [...pages]
    const draggedPageIndex = reorderedPages.findIndex(
      (listedPage) => listedPage.id === draggedPageId
    )

    if (draggedPageIndex === -1) {
      clearPageDragState()
      return
    }

    const [draggedPage] = reorderedPages.splice(
      draggedPageIndex,
      1
    )
    const targetPageIndex = reorderedPages.findIndex(
      (listedPage) => listedPage.id === targetPageId
    )

    if (targetPageIndex === -1) {
      clearPageDragState()
      return
    }

    const insertionIndex =
      dragOverPosition === 'after'
        ? targetPageIndex + 1
        : targetPageIndex

    reorderedPages.splice(
      insertionIndex,
      0,
      draggedPage
    )

    const numberedPages = reorderedPages.map(
      (listedPage, index) => ({
        ...listedPage,
        page_number: index + 1
      })
    )

    setPages(numberedPages)
    clearPageDragState()

    const notebookId =
      page?.notebook?.id || page?.notebook_id

    if (!notebookId) {
      setPages(originalPages)
      return
    }

    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}/pages`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pageIds: numberedPages.map(
              (listedPage) => listedPage.id
            ),
            pendingDeletionPageIds:
              deletedPagesStackRef.current.map(
                (entry) => entry.page.id
              )
          })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to reorder pages')
      }
    } catch (error) {
      console.error('Failed to reorder pages:', error)
      setPages(originalPages)
      window.alert('Failed to reorder pages.')
    }
  }

  const handleFontSizeChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const size = e.target.value

    if (/^\d{0,2}$/.test(size)) {
      setFontSizeInput(size)
    }
  }

  const handleFontSizeBlur = () => {
    const enteredSize = Number.parseInt(fontSizeInput, 10)
    const currentSize = Number.parseInt(fontSize, 10) || 16
    const normalizedSize = Number.isNaN(enteredSize)
      ? currentSize
      : Math.min(72, Math.max(8, enteredSize))

    setIsFontSizeInputFocused(false)
    setFontSizeInput(String(normalizedSize))
    setFontSize(`${normalizedSize}px`)
  }

  const handleContentUpdate = (newContent: any) => {
    if (!page) return

    if (page.isPendingCreation) {
      pendingCreatedPageRef.current = {
        ...(pendingCreatedPageRef.current || page),
        content: newContent
      }

      setPage((currentPage) =>
        currentPage &&
        currentPage.id === page.id
          ? {
              ...currentPage,
              content: newContent
            }
          : currentPage
      )

      setPages((currentPages) =>
        currentPages.map((currentPage) =>
          currentPage.id === page.id
            ? {
                ...currentPage,
                content: newContent
              }
            : currentPage
        )
      )

      return
    }

    const serializedContent = JSON.stringify(newContent)

    if (
      serializedContent === lastSavedContentRef.current
    ) {
      pendingContentRef.current = null
      return
    }

    pendingContentRef.current = newContent

    if (contentSaveTimeoutRef.current) {
      clearTimeout(contentSaveTimeoutRef.current)
    }

    const pageId = page.id

    contentSaveTimeoutRef.current = setTimeout(() => {
      void saveContentNow(pageId)
    }, 750)
  }

  const askScribeAi = async (action: AiAction) => {
    const notebookId =
      page?.notebook?.id || page?.notebook_id

    const question = aiQuestion.trim()
    const requestTarget = aiTarget
    const requestSelection =
      requestTarget === 'selection' ? aiSelection : null

    if (
      !page ||
      !notebookId ||
      (action === 'ask' && !question)
    ) {
      return
    }

    if (requestTarget === 'selection' && !requestSelection) {
      setAiError('Select some page text first.')
      return
    }

    const targetLabel =
      requestTarget === 'selection' ? 'selection' : 'page'
    const actionLabels: Record<AiAction, string> = {
      explain: `Explain this ${targetLabel}`,
      check: `Fact-check this ${targetLabel}`,
      rewrite: `Research and rewrite this ${targetLabel}`,
      summarize: `Summarize this ${targetLabel}`,
      ask: question
    }

    setShowAiPanel(true)
    setIsAskingAi(true)
    setAiError(null)
    setAiMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text: actionLabels[action]
      }
    ])

    if (action === 'ask') {
      setAiQuestion('')
    }

    try {
      const saved = await saveContentNow(page.id)

      if (!saved) {
        throw new Error(
          'Your latest changes could not be saved before asking.'
        )
      }

      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notebookId,
          pageId: page.id,
          question,
          action,
          target: requestTarget,
          selectedText: requestSelection?.text || '',
          history: aiMessages.slice(-6).map((message) => ({
            role: message.role,
            content: message.text.slice(0, 4_000)
          }))
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'ScribeAI could not answer'
        )
      }

      const assistantMessageId = crypto.randomUUID()

      setAiMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: 'assistant',
          text: result.answer,
          action,
          target: requestTarget,
          selection: requestSelection || undefined,
          notebookCitations: result.citations || [],
          externalCitations:
            result.externalCitations || [],
          usedExternalResearch:
            result.usedExternalResearch === true
        }
      ])
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : 'ScribeAI could not answer'
      )
    } finally {
      setIsAskingAi(false)
    }
  }

  const replaceWithAiMessage = (message: AiMessage) => {
    const replacementText = cleanChatFormatting(
      message.text
    ).trim()

    if (!replacementText || !message.target) return

    if (
      message.target === 'page' &&
      pendingPageReplaceId !== message.id
    ) {
      setPendingPageReplaceId(message.id)
      return
    }

    setPendingPageReplaceId(null)
    setAiReplaceRequest({
      id: crypto.randomUUID(),
      sourceMessageId: message.id,
      target: message.target,
      text: replacementText,
      selection: message.selection
    })
  }

  const handlePreviousPage = async (
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (!page || pages.length === 0) return

    const currentIndex = pages.findIndex(
      (currentPage) => currentPage.id === page.id
    )

    if (currentIndex <= 0) return

    const saved = await saveContentNow(page.id)

    if (!saved) return

    openPageInPlace(pages[currentIndex - 1])
  }

  const handleNextPage = async (
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (
      !page ||
      pages.length === 0 ||
      isCreatingPageRef.current
    ) {
      return
    }

    const currentIndex = pages.findIndex(
      (currentPage) => currentPage.id === page.id
    )

    if (currentIndex === -1) return

    const saved = await saveContentNow(page.id)

    if (!saved) return

    if (currentIndex < pages.length - 1) {
      openPageInPlace(pages[currentIndex + 1])
      return
    }

    const notebookId =
      page.notebook?.id || page.notebook_id

    if (!notebookId) {
      console.error(
        'Cannot create page: notebook ID is missing'
      )
      return
    }

    isCreatingPageRef.current = true

    const temporaryPageId =
      `temp-${crypto.randomUUID()}`

    const temporaryPage: Page = {
      id: temporaryPageId,
      editorKey: temporaryPageId,
      title: 'Untitled Page',
      content: {
        type: 'doc',
        content: []
      },
      notebook: page.notebook,
      notebook_id: notebookId,
      isPendingCreation: true
    }

    pendingCreatedPageRef.current = temporaryPage

    setPages((currentPages) => [
      ...currentPages,
      temporaryPage
    ])

    openPageInPlace(temporaryPage)

    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}/pages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: 'Untitled Page',
            content: {
              type: 'doc',
              content: []
            }
          })
        }
      )

      if (!response.ok) {
        throw new Error(
          `Failed to create page: ${response.status}`
        )
      }

      const createdPage = await response.json()

      const latestTemporaryPage =
        pendingCreatedPageRef.current || temporaryPage

      const resolvedPage: Page = {
        ...createdPage,
        editorKey: latestTemporaryPage.editorKey,
        title: latestTemporaryPage.title,
        content: latestTemporaryPage.content,
        notebook:
          createdPage.notebook || page.notebook,
        notebook_id:
          createdPage.notebook_id || notebookId,
        isPendingCreation: false
      }

      setPages((currentPages) =>
        currentPages.map((currentPage) =>
          currentPage.id === temporaryPageId
            ? resolvedPage
            : currentPage
        )
      )

      setPage((currentPage) =>
        currentPage?.id === temporaryPageId
          ? resolvedPage
          : currentPage
      )

      if (
        activePageIdRef.current === temporaryPageId
      ) {
        activePageIdRef.current = createdPage.id

        window.history.pushState(
          {},
          '',
          `/editor/${createdPage.id}`
        )
      }

      const flushResponse = await fetch(
        `/api/pages/${createdPage.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: resolvedPage.title,
            content: resolvedPage.content
          })
        }
      )

      if (!flushResponse.ok) {
        throw new Error(
          `Page was created but initial edits failed to save: ${flushResponse.status}`
        )
      }

      lastSavedContentRef.current =
        JSON.stringify(resolvedPage.content ?? null)
      pendingContentRef.current = null
      pendingCreatedPageRef.current = null
    } catch (error) {
      console.error(
        'Failed to create next page:',
        error
      )

      const fallbackPage =
        pages[currentIndex] || page

      setPages((currentPages) =>
        currentPages.filter(
          (currentPage) =>
            currentPage.id !== temporaryPageId
        )
      )

      setPage((currentPage) =>
        currentPage?.id === temporaryPageId
          ? fallbackPage
          : currentPage
      )

      if (
        activePageIdRef.current === temporaryPageId
      ) {
        activePageIdRef.current = fallbackPage.id

        window.history.replaceState(
          {},
          '',
          `/editor/${fallbackPage.id}`
        )
      }

      pendingCreatedPageRef.current = null
    } finally {
      isCreatingPageRef.current = false
    }
  }

  const commitDeletedPage = async (
    pageToDelete: Page,
    originalIndex: number
  ) => {
    try {
      const response = await fetch(
        `/api/pages/${pageToDelete.id}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
        let message = 'Failed to delete page.'

        try {
          const body = await response.json()

          if (
            body &&
            typeof body.error === 'string'
          ) {
            message = body.error
          }
        } catch {
          // Keep the fallback message.
        }

        throw new Error(message)
      }

      deletedPagesStackRef.current =
        deletedPagesStackRef.current.filter(
          (entry) =>
            entry.page.id !== pageToDelete.id
        )

      return true
    } catch (error) {
      console.error('Failed to delete page:', error)

      deletedPagesStackRef.current =
        deletedPagesStackRef.current.filter(
          (entry) =>
            entry.page.id !== pageToDelete.id
        )

      setPages((currentPages) => {
        if (
          currentPages.some(
            (currentPage) =>
              currentPage.id === pageToDelete.id
          )
        ) {
          return currentPages
        }

        const restoredPages = [...currentPages]
        const safeIndex = Math.min(
          originalIndex,
          restoredPages.length
        )

        restoredPages.splice(
          safeIndex,
          0,
          pageToDelete
        )

        return restoredPages
      })

      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to delete page.'
      )

      return false
    }
  }

  const flushPendingDeletedPages = async () => {
    const pendingDeletions = [
      ...deletedPagesStackRef.current
    ]

    const results = await Promise.all(
      pendingDeletions.map((entry) =>
        commitDeletedPage(
          entry.page,
          entry.originalIndex
        )
      )
    )

    return results.every(Boolean)
  }

  const deletePageById = (pageId: string) => {
    if (
      pages.length <= 1 ||
      isCreatingPageRef.current
    ) {
      return
    }

    const pageIndex = pages.findIndex(
      (currentPage) => currentPage.id === pageId
    )

    if (pageIndex === -1) return

    const pageToDelete = pages[pageIndex]

    if (pageToDelete.isPendingCreation) {
      return
    }

    const fallbackPage =
      pages[pageIndex + 1] ||
      pages[pageIndex - 1]

    if (!fallbackPage) return

    const wasCurrentPage = page?.id === pageId

    if (wasCurrentPage) {
      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current)
        contentSaveTimeoutRef.current = null
      }

      pendingContentRef.current = null
      openPageInPlace(fallbackPage, 'replace')
    }

    setPages((currentPages) =>
      currentPages.filter(
        (currentPage) => currentPage.id !== pageId
      )
    )

    setSelectedReadPageId(fallbackPage.id)

    deleteSurfaceActiveRef.current = true

    deletedPagesStackRef.current.push({
      page: pageToDelete,
      originalIndex: pageIndex
    })
  }

  const restoreLastDeletedPage = () => {
    const entry =
      deletedPagesStackRef.current.pop()

    if (!entry) {
      return
    }

    setPages((currentPages) => {
      if (
        currentPages.some(
          (currentPage) =>
            currentPage.id === entry.page.id
        )
      ) {
        return currentPages
      }

      const restoredPages = [...currentPages]
      const safeIndex = Math.min(
        entry.originalIndex,
        restoredPages.length
      )

      restoredPages.splice(
        safeIndex,
        0,
        entry.page
      )

      return restoredPages
    })

    openPageInPlace(entry.page, 'replace')
    setSelectedReadPageId(entry.page.id)
    deleteSurfaceActiveRef.current = true
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof HTMLElement)) {
        deleteSurfaceActiveRef.current = false
        return
      }

      const clickedInsideMainContent =
        editorContainerRef.current?.contains(target) ?? false

      const clickedEditableControl = Boolean(
        target.closest(
          'input, textarea, select, button, [contenteditable="true"], .ProseMirror'
        )
      )

      deleteSurfaceActiveRef.current =
        clickedInsideMainContent &&
        !clickedEditableControl
    }

    const handleDeletePageKeyDown = (
      event: KeyboardEvent
    ) => {
      const isUndoCommand =
        event.key.toLowerCase() === 'z' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey

      if (isUndoCommand) {
        const target = event.target

        if (
          target instanceof HTMLElement &&
          target.closest(
            'input, textarea, [contenteditable="true"], .ProseMirror'
          )
        ) {
          return
        }

        if (
          deletedPagesStackRef.current.length > 0
        ) {
          event.preventDefault()
          restoreLastDeletedPage()
        }

        return
      }

      if (
        event.key !== 'Backspace' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return
      }

      const target = event.target

      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], .ProseMirror'
        )
      ) {
        return
      }

      const pageIdToDelete =
        mode === 'read'
          ? selectedReadPageId || page?.id
          : deleteSurfaceActiveRef.current
            ? page?.id
            : null

      if (
        !pageIdToDelete ||
        pages.length <= 1
      ) {
        return
      }

      event.preventDefault()
      deletePageById(pageIdToDelete)
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown,
      true
    )

    window.addEventListener(
      'keydown',
      handleDeletePageKeyDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true
      )

      window.removeEventListener(
        'keydown',
        handleDeletePageKeyDown
      )
    }
  }, [
    mode,
    page,
    pages,
    selectedReadPageId
  ])

  const handleContentAreaMouseDown = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const target = e.target

    if (!(target instanceof HTMLElement)) {
      return
    }

    if (
      target.closest(
        'input, textarea, button, select, [contenteditable="true"]'
      )
    ) {
      return
    }

    const editorElement =
      e.currentTarget.querySelector(
        '.ProseMirror'
      ) as HTMLElement | null

    if (!editorElement) {
      return
    }

    e.preventDefault()

    editorElement.focus({
      preventScroll: true
    })

    const selection = window.getSelection()
    const range = document.createRange()

    range.selectNodeContents(editorElement)
    range.collapse(false)

    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  const handleSidebarAction = (
    action: () => void,
    e?: React.MouseEvent
  ) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const selection = window.getSelection()
    let savedRange: Range | null = null

    if (
      selection &&
      selection.rangeCount > 0
    ) {
      savedRange = selection
        .getRangeAt(0)
        .cloneRange()
    }

    action()

    requestAnimationFrame(() => {
      const editorElement =
        document.querySelector(
          '.ProseMirror'
        ) as HTMLElement

      if (editorElement) {
        editorElement.focus({
          preventScroll: true
        })

        if (
          savedRange &&
          selection
        ) {
          selection.removeAllRanges()
          selection.addRange(savedRange)
        }
      }
    })
  }

  const handleModeChange = (
    nextMode: 'read' | 'write'
  ) => {
    setMode(nextMode)

    requestAnimationFrame(() => {
      const editorElement =
        document.querySelector(
          '.ProseMirror'
        ) as HTMLElement

      if (editorElement) {
        editorElement.focus({
          preventScroll: true
        })
      }
    })
  }

  const handleColorChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    handleSidebarAction(() =>
      setTextColor(e.target.value)
    )
  }

  const handleBoldClick = (
    e: React.MouseEvent
  ) => {
    handleSidebarAction(
      () => setBold(!isBold),
      e
    )
  }

  const handleItalicClick = (
    e: React.MouseEvent
  ) => {
    handleSidebarAction(
      () => setItalic(!isItalic),
      e
    )
  }

  const handleStrikeClick = (
    e: React.MouseEvent
  ) => {
    handleSidebarAction(
      () =>
        setStrikethrough(
          !isStrikethrough
        ),
      e
    )
  }

  const handleAlignmentClick = (
    align:
      | 'left'
      | 'center'
      | 'right'
      | 'justify',
    e: React.MouseEvent
  ) => {
    handleSidebarAction(
      () => setAlignment(align),
      e
    )
  }

  const handleListClick = (
    listType: 'bullets' | 'numbers',
    e: React.MouseEvent
  ) => {
    handleSidebarAction(() => {
      if (listType === 'bullets') {
        if (isOrderedList) {
          setOrderedList(false)
        }

        setBulletList(!isBulletList)
        return
      }

      if (isBulletList) {
        setBulletList(false)
      }

      setOrderedList(!isOrderedList)
    }, e)
  }

  const handleHomeClick = async (
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    if (page) {
      const saved = await saveContentNow(page.id)

      if (!saved) {
        return
      }
    }

    const deletionsSaved =
      await flushPendingDeletedPages()

    if (!deletionsSaved) {
      return
    }

    router.push('/dashboard')
  }

  const handleDeleteNotebookClick = (
    e: React.MouseEvent
  ) => {
    e.preventDefault()
    e.stopPropagation()

    setDeleteError(null)
    setShowDeleteModal(true)
  }

  const handleRenameNotebookClick = () => {
    setShowFileMenu(false)

    requestAnimationFrame(() => {
      notebookNameInputRef.current?.focus()
      notebookNameInputRef.current?.select()
    })
  }

  const handleCancelDeleteNotebook = () => {
    if (isDeletingNotebook) return

    setDeleteError(null)
    setShowDeleteModal(false)
  }

  const handleConfirmDeleteNotebook = async () => {
    if (!page || isDeletingNotebook) return

    const notebookId =
      page.notebook?.id || page.notebook_id

    if (!notebookId) {
      setDeleteError('Notebook ID is missing.')
      return
    }

    setIsDeletingNotebook(true)
    setDeleteError(null)

    try {
      const saved = await saveContentNow(page.id)

      if (!saved) {
        setDeleteError(
          'The current page could not be saved. Notebook deletion was cancelled.'
        )
        return
      }

      const response = await fetch(
        `/api/notebooks/${notebookId}`,
        {
          method: 'DELETE'
        }
      )

      if (!response.ok) {
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
          // Keep the fallback message when the response is not JSON.
        }

        throw new Error(message)
      }

      sessionStorage.setItem(
        PENDING_NOTEBOOK_DELETION_KEY,
        JSON.stringify({
          notebookId,
          requestedAt: Date.now()
        })
      )

      deletedPagesStackRef.current = []
      setShowDeleteModal(false)
      window.location.replace('/dashboard')
    } catch (error) {
      console.error('Failed to delete notebook:', error)

      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Failed to delete notebook.'
      )
    } finally {
      setIsDeletingNotebook(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '56px',
              height: '56px',
              marginBottom: '24px',
              borderRadius: '16px',
              border: '1px solid #1f2937',
              background: 'rgba(17, 24, 39, 0.8)',
              boxShadow:
                '0 24px 60px rgba(30, 64, 175, 0.18)'
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '15px',
                borderRadius: '9999px',
                border: '2px solid #374151',
                borderTopColor: '#3b82f6',
                animation:
                  'scribeai-spin 0.8s linear infinite'
              }}
            />
          </div>

          <h1
            style={{
              margin: 0,
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '-0.01em'
            }}
          >
            Opening your notebook
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#6b7280',
              fontSize: '14px'
            }}
          >
            Preparing the editor
          </p>

          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginTop: '20px'
            }}
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '9999px',
                  background: '#3b82f6',
                  animation:
                    'scribeai-pulse 1.2s ease-in-out infinite',
                  animationDelay: `${delay}ms`
                }}
              />
            ))}
          </div>

          <style jsx>{`
            @keyframes scribeai-spin {
              to {
                transform: rotate(360deg);
              }
            }

            @keyframes scribeai-pulse {
              0%,
              100% {
                opacity: 0.35;
                transform: scale(0.9);
              }

              50% {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          {error}
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          Page not found
        </div>
      </div>
    )
  }

  const currentPageIndex = pages.findIndex(
    (currentPage) => currentPage.id === page.id
  )

  const hasPreviousPage =
    currentPageIndex > 0

  const hasNextPage =
    currentPageIndex >= 0 &&
    currentPageIndex < pages.length - 1

  const canUseNextButton =
    currentPageIndex >= 0 &&
    pages.length > 0

  return (
    <div
      className={styles.editorContainer}
      data-editor-tour="editor-shell"
    >
      <div className={styles.sidebar}>
        <div className={styles.notebookNameSection}>
          <label className={styles.sidebarLabel}>
            Notebook
          </label>

          <input
            ref={notebookNameInputRef}
            data-editor-tour="notebook-name"
            className={styles.notebookNameInput}
            value={
              page.notebook?.name === 'My Notebook'
                ? ''
                : page.notebook?.name || ''
            }
            placeholder="My Notebook"
            maxLength={100}
            onChange={handleNotebookNameChange}
            onBlur={handleNotebookNameBlur}
          />
        </div>

        <div
          className={styles.modeSection}
          data-editor-tour="mode-controls"
        >
          <label className={styles.modeLabel}>
            Mode
          </label>

          <div className={styles.modeButtons}>
            <button
              className={`${styles.modeButton} ${
                mode === 'read'
                  ? styles.activeModeButton
                  : ''
              }`}
              type="button"
              onClick={() => handleModeChange('read')}
            >
              Read
            </button>

            <button
              className={`${styles.modeButton} ${
                mode === 'write'
                  ? styles.activeModeButton
                  : ''
              }`}
              type="button"
              onClick={() => handleModeChange('write')}
            >
              Write
            </button>
          </div>
        </div>

        {mode === 'write' ? (
          <div
            className={styles.sidebarContent}
            data-editor-tour="writing-tools"
          >
            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>
                Formatting
              </label>

              <div className={styles.formattingGrid}>
                <button
                  tabIndex={-1}
                  className={`${styles.formattingOption} ${
                    isBold
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={handleBoldClick}
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  <strong>B</strong>
                </button>

                <button
                  tabIndex={-1}
                  className={`${styles.formattingOption} ${
                    isItalic
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={handleItalicClick}
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  <em>I</em>
                </button>

                <button
                  tabIndex={-1}
                  className={`${styles.formattingOption} ${
                    isStrikethrough
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={handleStrikeClick}
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  <s>S</s>
                </button>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>
                Font
              </label>

              <select
                className={styles.sidebarSelect}
                value={fontFamily}
                disabled
                aria-disabled="true"
                title="Font family support is not available yet"
              >
                <option value="var(--font-roboto-condensed)">
                  Roboto Condensed
                </option>

                <option value="Arial">
                  Arial
                </option>

                <option value="Times New Roman">
                  Times New Roman
                </option>

                <option value="Georgia">
                  Georgia
                </option>

                <option value="Courier New">
                  Courier New
                </option>
              </select>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>
                Size
              </label>

              <div className={styles.sizeInputContainer}>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Font size in pixels"
                  value={fontSizeInput}
                  onChange={handleFontSizeChange}
                  onBlur={handleFontSizeBlur}
                  onFocus={(event) => {
                    setIsFontSizeInputFocused(true)
                    event.currentTarget.select()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    }
                  }}
                  className={styles.sizeInput}
                  maxLength={2}
                />

                <span className={styles.sizeUnit}>
                  px
                </span>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>
                Color
              </label>

              <div className={styles.colorPicker}>
                <div
                  className={
                    styles.colorPreviewContainer
                  }
                  onClick={() =>
                    document
                      .getElementById(
                        'colorInput'
                      )
                      ?.click()
                  }
                >
                  <div
                    className={
                      styles.colorPreview
                    }
                    style={{
                      backgroundColor:
                        textColor
                    }}
                  />

                  <span
                    className={styles.colorHex}
                  >
                    {textColor}
                  </span>
                </div>

                <input
                  id="colorInput"
                  type="color"
                  value={textColor}
                  className={styles.colorInput}
                  onChange={handleColorChange}
                />
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>
                Alignment
              </label>

              <div className={styles.alignmentGrid}>
                <button
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${
                    alignment === 'left'
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={(e) =>
                    handleAlignmentClick(
                      'left',
                      e
                    )
                  }
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  Left
                </button>

                <button
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${
                    alignment === 'center'
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={(e) =>
                    handleAlignmentClick(
                      'center',
                      e
                    )
                  }
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  Center
                </button>

                <button
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${
                    alignment === 'right'
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={(e) =>
                    handleAlignmentClick(
                      'right',
                      e
                    )
                  }
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  Right
                </button>

                <button
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${
                    alignment === 'justify'
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={(e) =>
                    handleAlignmentClick(
                      'justify',
                      e
                    )
                  }
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  Justify
                </button>
              </div>
            </div>

            <div className={styles.sidebarSection}>
              <label className={styles.sidebarLabel}>
                Lists
              </label>

              <div className={styles.listGrid}>
                <button
                  tabIndex={-1}
                  className={`${styles.listOption} ${
                    isBulletList
                      ? styles.activeList
                      : ''
                  }`}
                  type="button"
                  onClick={(e) =>
                    handleListClick(
                      'bullets',
                      e
                    )
                  }
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  • Bullets
                </button>

                <button
                  tabIndex={-1}
                  className={`${styles.listOption} ${
                    isOrderedList
                      ? styles.activeList
                      : ''
                  }`}
                  type="button"
                  onClick={(e) =>
                    handleListClick(
                      'numbers',
                      e
                    )
                  }
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                >
                  1. Numbers
                </button>
              </div>
            </div>

            <div
              className={styles.sidebarSection}
              aria-disabled="true"
            >
              <label className={styles.sidebarLabel}>
                Insert
              </label>

              <div className={styles.insertGrid}>
                <button
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  disabled
                  title="Columns are not available yet"
                >
                  Columns
                </button>

                <button
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  disabled
                  title="Rows are not available yet"
                >
                  Rows
                </button>

                <button
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  disabled
                  title="Tables are not available yet"
                >
                  Table
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.sidebarContent}>
            <div
              className={styles.pagesList}
              data-editor-tour="read-page-list"
            >
              <label className={styles.sidebarLabel}>
                Pages
              </label>

              <div className={styles.pagesScroll}>
                {pages.map((listedPage) => (
                  <button
                    key={listedPage.id}
                    className={`${styles.pageItem} ${
                      listedPage.id === selectedReadPageId
                        ? styles.activePage
                        : ''
                    } ${
                      listedPage.id === draggedPageId
                        ? styles.draggingPage
                        : ''
                    } ${
                      listedPage.id === dragOverPageId &&
                      dragOverPosition === 'before'
                        ? styles.dragBefore
                        : ''
                    } ${
                      listedPage.id === dragOverPageId &&
                      dragOverPosition === 'after'
                        ? styles.dragAfter
                        : ''
                    }`}
                    draggable
                    aria-grabbed={listedPage.id === draggedPageId}
                    onDragStart={(event) =>
                      handlePageDragStart(
                        event,
                        listedPage.id
                      )
                    }
                    onDragOver={(event) =>
                      handlePageDragOver(
                        event,
                        listedPage.id
                      )
                    }
                    onDrop={(event) =>
                      void handlePageDrop(
                        event,
                        listedPage.id
                      )
                    }
                    onDragEnd={clearPageDragState}
                    onClick={() =>
                      handlePageClick(
                        listedPage.id
                      )
                    }
                    type="button"
                  >
                    •{' '}
                    {listedPage.title ||
                      'Untitled Page'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div
          className={styles.fileOptionsSection}
          ref={fileMenuRef}
          data-editor-tour="editor-utilities"
        >
          <div className={styles.fileMenuContainer}>
            <button
              tabIndex={-1}
              className={`${styles.fileOption} ${styles.sidebarUtilityButton}`}
              type="button"
              aria-expanded={showFileMenu}
              aria-haspopup="menu"
              onClick={() =>
                setShowFileMenu((isOpen) => !isOpen)
              }
            >
              FILE
            </button>

            {showFileMenu && (
              <div
                className={styles.fileMenu}
                role="menu"
              >
                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={handleRenameNotebookClick}
                >
                  Rename Notebook
                </button>

                <button
                  className={`${styles.fileMenuOption} ${styles.dangerFileMenuOption}`}
                  type="button"
                  role="menuitem"
                  disabled={isDeletingNotebook}
                  onClick={(event) => {
                    setShowFileMenu(false)
                    handleDeleteNotebookClick(event)
                  }}
                >
                  Delete Notebook
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    const notebookId =
                      page.notebook?.id || page.notebook_id

                    if (!notebookId) return

                    setShowFileMenu(false)

                    if (await saveContentNow(page.id)) {
                      router.push(`/quiz/${notebookId}`)
                    }
                  }}
                >
                  Study Quiz
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={(event) => {
                    setShowFileMenu(false)
                    void handleHomeClick(event)
                  }}
                >
                  Home
                </button>
              </div>
            )}
          </div>

          <div className={styles.fileGrid}>
            <button
              tabIndex={-1}
              className={`${styles.fileOption} ${styles.sidebarUtilityButton}`}
              type="button"
              onClick={() => setShowSettingsModal(true)}
            >
              SETTINGS
            </button>
          </div>
        </div>
      </div>

      <div
        className={styles.mainContent}
        ref={editorContainerRef}
      >
        {!showAiPanel && (
          <button
            type="button"
            className={styles.aiLauncher}
            onClick={() => setShowAiPanel(true)}
          >
            Ask AI
          </button>
        )}

        <div
          className={`${styles.documentArea} ${
            showAiPanel ? styles.documentAreaWithAi : ''
          }`}
        >
          <button
            tabIndex={-1}
            className={`${styles.navArrow} ${styles.navArrowLeft} navArrow`}
            data-editor-tour="page-navigation"
            onClick={handlePreviousPage}
            disabled={!hasPreviousPage}
            style={{
              opacity: hasPreviousPage ? 1 : 0.3
            }}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
          >
            ‹
          </button>

          <div
            className={`${styles.paper} ${
              darkEditorPaper ? styles.darkPaper : ''
            }`}
          >
            <input
              key={page.editorKey || page.id}
              data-editor-tour="page-title"
              value={page.title || ''}
              className={styles.titleInput}
              placeholder="Page Title"
              onChange={handlePageTitleChange}
              onFocus={handlePageTitleFocus}
              onBlur={handlePageTitleBlur}
              style={{
                opacity:
                  isTitleFocused &&
                  (page.title || '')
                    .trim()
                    .toLowerCase() ===
                    'untitled page'
                    ? 0.45
                    : 1,
                transition: 'opacity 140ms ease'
              }}
            />

            <div
              className={styles.contentArea}
              data-editor-tour="writing-surface"
              onMouseDown={handleContentAreaMouseDown}
            >
              <TiptapEditor
                key={page.editorKey || page.id}
                content={page.content}
                onUpdate={handleContentUpdate}
                insertRequest={aiInsertRequest}
                replaceRequest={aiReplaceRequest}
                onSelectionChange={(selection) => {
                  setAiSelection(selection)

                  if (selection) {
                    setAiTarget('selection')
                  } else {
                    setAiTarget('page')
                  }
                }}
                onReplaceResult={(messageId, applied) => {
                  if (applied) {
                    setReplacedAiMessageIds((current) => [
                      ...current,
                      messageId
                    ])
                    setAiError(null)
                    return
                  }

                  setAiError(
                    'That text changed while AI was working. Select it again and retry.'
                  )
                }}
              />
            </div>
          </div>

          <button
            tabIndex={-1}
            className={`${styles.navArrow} ${styles.navArrowRight} navArrow`}
            onClick={handleNextPage}
            disabled={!canUseNextButton}
            style={{
              opacity: canUseNextButton ? 1 : 0.3
            }}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
          >
            {hasNextPage ? '›' : '+›'}
          </button>

          {showAiPanel && (
            <aside
              className={styles.aiPanel}
              aria-label="ScribeAI notebook assistant"
            >
              <div className={styles.aiPanelHeader}>
                <div>
                  <h2>ScribeAI</h2>
                  <span className={styles.aiStatus}>
                    Notebook assistant
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.aiCloseButton}
                  aria-label="Close ScribeAI"
                  onClick={() => setShowAiPanel(false)}
                >
                  x
                </button>
              </div>

              <div className={styles.aiMessages}>
                {aiMessages.length === 0 && (
                  <div className={styles.aiWelcome}>
                    Ask about this page, expand on a topic, or ask AI
                    to draft something you can add to your notes.
                  </div>
                )}

                {aiMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.aiMessage} ${
                      message.role === 'user'
                        ? styles.aiUserMessage
                        : styles.aiAssistantMessage
                    }`}
                  >
                    {message.role === 'assistant' &&
                      message.usedExternalResearch && (
                        <span className={styles.aiResearchBadge}>
                          WEB VERIFIED
                        </span>
                      )}

                    {message.role === 'assistant' &&
                      message.target && (
                        <span className={styles.aiScopeBadge}>
                          {message.target === 'selection'
                            ? 'SELECTION'
                            : 'WHOLE PAGE'}
                        </span>
                      )}

                    <p>{renderAiMessageText(message)}</p>

                    {message.notebookCitations &&
                      message.notebookCitations.length > 0 && (
                        <div className={styles.aiSources}>
                          <span>Notebook</span>
                          {message.notebookCitations.map(
                            (citation) => (
                              <button
                                key={`${citation.number}-${citation.pageId}`}
                                type="button"
                                title={citation.excerpt}
                                onClick={() => {
                                  const sourcePage = pages.find(
                                    (candidate) =>
                                      candidate.id ===
                                      citation.pageId
                                  )

                                  if (sourcePage) {
                                    openPageInPlace(sourcePage)
                                  }
                                }}
                              >
                                [{citation.number}]{' '}
                                {citation.pageTitle}
                              </button>
                            )
                          )}
                        </div>
                      )}

                    {message.externalCitations &&
                      message.externalCitations.length > 0 && (
                        <div className={styles.aiExternalSources}>
                          <span>External sources</span>
                          {message.externalCitations.map(
                            (citation) => (
                              <a
                                key={citation.url}
                                href={citation.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {citation.title}
                              </a>
                            )
                          )}
                        </div>
                      )}

                    {message.role === 'assistant' && (
                      <div className={styles.aiMessageActions}>
                        <button
                          type="button"
                          disabled={addedAiMessageIds.includes(
                            message.id
                          )}
                          onClick={() => {
                            const noteText = cleanChatFormatting(
                              message.text
                            ).trim()

                            if (!noteText) return

                            setAiInsertRequest({
                              id: crypto.randomUUID(),
                              text: noteText
                            })
                            setAddedAiMessageIds((current) => [
                              ...current,
                              message.id
                            ])
                          }}
                        >
                          {addedAiMessageIds.includes(message.id)
                            ? 'Added'
                            : 'Add to page'}
                        </button>

                        {(message.action === 'rewrite' ||
                          message.action === 'summarize') &&
                          message.target && (
                            <button
                              type="button"
                              disabled={replacedAiMessageIds.includes(
                                message.id
                              )}
                              className={
                                pendingPageReplaceId === message.id
                                  ? styles.aiConfirmReplaceButton
                                  : ''
                              }
                              onClick={() =>
                                replaceWithAiMessage(message)
                              }
                            >
                              {replacedAiMessageIds.includes(
                                message.id
                              )
                                ? 'Applied'
                                : pendingPageReplaceId ===
                                    message.id
                                  ? 'Confirm replace'
                                  : message.target === 'selection'
                                    ? 'Replace selection'
                                    : 'Replace page'}
                            </button>
                          )}

                        {pendingPageReplaceId === message.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingPageReplaceId(null)
                            }
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isAskingAi && (
                  <div
                    className={`${styles.aiMessage} ${styles.aiAssistantMessage} ${styles.aiThinking}`}
                  >
                    Searching and reading...
                  </div>
                )}
                <div ref={aiMessagesEndRef} />
              </div>

              <div className={styles.aiComposer}>
                <div className={styles.aiTargetRow}>
                  <span>WORK ON</span>
                  <button
                    type="button"
                    className={
                      aiTarget === 'page'
                        ? styles.aiTargetActive
                        : ''
                    }
                    onClick={() => setAiTarget('page')}
                  >
                    Whole page
                  </button>
                  <button
                    type="button"
                    disabled={!aiSelection}
                    title={
                      aiSelection?.text ||
                      'Select text in the page first'
                    }
                    className={
                      aiTarget === 'selection'
                        ? styles.aiTargetActive
                        : ''
                    }
                    onClick={() => setAiTarget('selection')}
                  >
                    Selection
                  </button>
                </div>

                {aiTarget === 'selection' && aiSelection && (
                  <div className={styles.aiSelectionPreview}>
                    “
                    {aiSelection.text.length > 110
                      ? `${aiSelection.text.slice(0, 110)}...`
                      : aiSelection.text}
                    ”
                  </div>
                )}

                <div className={styles.aiActionRow}>
                  <button
                    type="button"
                    disabled={isAskingAi}
                    onClick={() => void askScribeAi('explain')}
                  >
                    Explain
                  </button>
                  <button
                    type="button"
                    disabled={isAskingAi}
                    onClick={() => void askScribeAi('summarize')}
                  >
                    Summarize
                  </button>
                  <button
                    type="button"
                    disabled={isAskingAi}
                    onClick={() => void askScribeAi('check')}
                  >
                    Fact-check
                  </button>
                  <button
                    type="button"
                    disabled={isAskingAi}
                    onClick={() => void askScribeAi('rewrite')}
                  >
                    Rewrite
                  </button>
                </div>

                {aiError && (
                  <p className={styles.aiError}>{aiError}</p>
                )}

                <div className={styles.aiInputRow}>
                  <textarea
                    value={aiQuestion}
                    maxLength={2000}
                    rows={1}
                    placeholder="Ask, expand, or draft notes..."
                    onChange={(event) =>
                      setAiQuestion(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault()

                        if (!isAskingAi && aiQuestion.trim()) {
                          void askScribeAi('ask')
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.aiAskButton}
                    aria-label="Send message"
                    disabled={
                      isAskingAi ||
                      !aiQuestion.trim()
                    }
                    onClick={() => void askScribeAi('ask')}
                  >
                    Send
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>

      </div>

      {showDeleteModal && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelDeleteNotebook()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '24px'
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-notebook-title"
            aria-describedby="delete-notebook-description"
            style={{
              width: '100%',
              maxWidth: '420px',
              borderRadius: '12px',
              background: '#111827',
              border: '1px solid #374151',
              padding: '24px',
              boxShadow:
                '0 24px 60px rgba(0, 0, 0, 0.45)'
            }}
          >
            <h2
              id="delete-notebook-title"
              style={{
                margin: 0,
                color: '#f9fafb',
                fontSize: '18px',
                fontWeight: 600,
                fontFamily: 'Geist'
              }}
            >
              Delete Notebook
            </h2>

            <p
              id="delete-notebook-description"
              style={{
                margin: '8px 0 0',
                color: '#9ca3af',
                fontSize: '14px',
                lineHeight: 1.5,
                fontFamily: 'Geist'
              }}
            >
              This cannot be undone. Continue?
            </p>

            {deleteError && (
              <p
                role="alert"
                style={{
                  margin: '14px 0 0',
                  color: '#fca5a5',
                  lineHeight: 1.4
                }}
              >
                {deleteError}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '22px',
                paddingTop: '16px',
                borderTop: '1px solid #374151'
              }}
            >
              <button
                type="button"
                onClick={handleConfirmDeleteNotebook}
                disabled={isDeletingNotebook}
                style={{
                  border: '1px solid #6b3038',
                  borderRadius: '6px',
                  background: '#3b1d23',
                  color: '#f1b5bc',
                  padding: '9px 14px',
                  fontFamily: 'Geist',
                  cursor: isDeletingNotebook
                    ? 'not-allowed'
                    : 'pointer',
                  opacity: isDeletingNotebook
                    ? 0.65
                    : 1
                }}
              >
                {isDeletingNotebook
                  ? 'Deleting...'
                  : 'Confirm'}
              </button>

              <button
                type="button"
                onClick={handleCancelDeleteNotebook}
                disabled={isDeletingNotebook}
                autoFocus
                style={{
                  border: '1px solid #64748b',
                  borderRadius: '6px',
                  background: '#475569',
                  color: '#f8fafc',
                  padding: '9px 14px',
                  fontFamily: 'Geist',
                  cursor: isDeletingNotebook
                    ? 'not-allowed'
                    : 'pointer',
                  opacity: isDeletingNotebook
                    ? 0.65
                    : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div
          className={styles.settingsBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowSettingsModal(false)
            }
          }}
        >
          <div
            className={styles.settingsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
          >
            <div className={styles.settingsModalHeader}>
              <h2 id="settings-modal-title">
                Settings
              </h2>

              <button
                className={styles.settingsCloseButton}
                type="button"
                aria-label="Close settings"
                onClick={() => setShowSettingsModal(false)}
                autoFocus
              >
                ×
              </button>
            </div>

            <div className={styles.settingsModalBody}>
              <section className={`${styles.settingsSection} ${styles.settingsTutorialSection}`}>
                <div className={styles.settingsTutorialHeading}>
                  <h3 className={styles.settingsSectionTitle}>
                    Tutorial
                  </h3>
                  <span className={styles.settingsTutorialBadge}>
                    Essential
                  </span>
                </div>

                <div className={styles.settingsPreferenceRow}>
                  <div>
                    <p className={styles.settingsPreferenceName}>
                      Learn every ScribeAI workflow
                    </p>
                    <p className={styles.settingsPreferenceDescription}>
                      Take the complete guided tour of notebooks, pages, editing, commands, recovery, and account tools.
                    </p>
                  </div>

                  <div className={styles.settingsTutorialActions}>
                    <button
                      type="button"
                      className={styles.settingsTutorialButton}
                      onClick={() => {
                        setShowSettingsModal(false)
                        setShowTutorialModal(true)
                      }}
                    >
                      Full Tutorial
                    </button>

                    <button
                      type="button"
                      className={styles.settingsTutorialSecondaryButton}
                      onClick={() => {
                        setShowSettingsModal(false)
                        setShowEditorTour(true)
                      }}
                    >
                      Replay Editor Tour
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  Editor Paper
                </h3>

                <div className={styles.settingsPreferenceRow}>
                  <div>
                    <p className={styles.settingsPreferenceName}>
                      Writing surface
                    </p>
                    <p className={styles.settingsPreferenceDescription}>
                      Choose a light or dark page.
                    </p>
                  </div>

                  <div
                    className={styles.paperThemeControl}
                    role="radiogroup"
                    aria-label="Editor paper theme"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!darkEditorPaper}
                      className={`${styles.paperThemeButton} ${
                        !darkEditorPaper
                          ? styles.paperThemeButtonActive
                          : ''
                      }`}
                      onClick={() => {
                        setDarkEditorPaper(false)
                        localStorage.setItem(
                          EDITOR_PAPER_THEME_KEY,
                          'light'
                        )
                      }}
                    >
                      Light
                    </button>

                    <button
                      type="button"
                      role="radio"
                      aria-checked={darkEditorPaper}
                      className={`${styles.paperThemeButton} ${
                        darkEditorPaper
                          ? styles.paperThemeButtonActive
                          : ''
                      }`}
                      onClick={() => {
                        setDarkEditorPaper(true)
                        localStorage.setItem(
                          EDITOR_PAPER_THEME_KEY,
                          'dark'
                        )
                      }}
                    >
                      Dark
                    </button>
                  </div>
                </div>
              </section>

              <section className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  Commands
                </h3>

                <div className={styles.commandList}>
                  <div className={styles.commandRow}>
                    <kbd className={styles.commandKeys}>
                      Ctrl/Cmd + Z
                    </kbd>
                    <span className={styles.commandDescription}>
                      Undo text edits. Outside editable fields, restore the most recently deleted page.
                    </span>
                  </div>

                  <div className={styles.commandRow}>
                    <kbd className={styles.commandKeys}>
                      Backspace
                    </kbd>
                    <span className={styles.commandDescription}>
                      Delete the current or selected page when focus is in the black area outside editable controls.
                    </span>
                  </div>

                  <div className={styles.commandRow}>
                    <kbd className={styles.commandKeys}>
                      Ctrl/Cmd + B
                    </kbd>
                    <span className={styles.commandDescription}>
                      Toggle bold text.
                    </span>
                  </div>

                  <div className={styles.commandRow}>
                    <kbd className={styles.commandKeys}>
                      Ctrl/Cmd + I
                    </kbd>
                    <span className={styles.commandDescription}>
                      Toggle italic text.
                    </span>
                  </div>

                  <div className={styles.commandRow}>
                    <kbd className={styles.commandKeys}>
                      Tab / Shift + Tab
                    </kbd>
                    <span className={styles.commandDescription}>
                      Indent or outdent text and nested list items.
                    </span>
                  </div>
                </div>
              </section>

              <section className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  Page Navigation
                </h3>

                <div className={styles.commandList}>
                  <div className={styles.commandRow}>
                    <span className={styles.commandKeys}>
                      ‹ Button
                    </span>
                    <span className={styles.commandDescription}>
                      Open the previous page.
                    </span>
                  </div>

                  <div className={styles.commandRow}>
                    <span className={styles.commandKeys}>
                      › / +› Button
                    </span>
                    <span className={styles.commandDescription}>
                      Open the next page, or create one at the end of the notebook.
                    </span>
                  </div>
                </div>
              </section>

              <section className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  Reorder Pages
                </h3>

                <div
                  className={styles.reorderGuide}
                  aria-label="Drag page titles to reorder them in Read mode"
                >
                  <div className={styles.reorderGuidePage}>
                    <span>••</span>
                    <span>Page 1</span>
                  </div>

                  <div className={`${styles.reorderGuidePage} ${styles.reorderGuideActive}`}>
                    <span>••</span>
                    <span>Page 2</span>
                    <span className={styles.reorderGuideArrow}>
                      ↕
                    </span>
                  </div>

                  <div className={styles.reorderGuidePage}>
                    <span>••</span>
                    <span>Page 3</span>
                  </div>
                </div>

                <p className={styles.settingsNote}>
                  In Read mode, drag a bulleted page title above or below another title. The new order saves automatically.
                </p>
              </section>

              <section className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>
                  Saving
                </h3>

                <p className={styles.settingsNote}>
                  Page content and notebook names save automatically after a short pause in typing.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}

      <TutorialModal
        isOpen={showTutorialModal}
        onClose={() => {
          setShowTutorialModal(false)
          setShowSettingsModal(true)
        }}
      />

      <EditorShowcaseTour
        isOpen={showEditorTour}
        currentMode={mode}
        onModeChange={(nextMode) => setMode(nextMode)}
        onComplete={() => {
          if (page.user_id) {
            localStorage.setItem(
              `${EDITOR_TOUR_COMPLETED_KEY}:${page.user_id}`,
              'true'
            )
          }
          setShowEditorTour(false)
        }}
      />
    </div>
  )
}
