'use client'

import styles from '@/app/editor/[id]/Editor.module.css'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEditorStore } from '@/components/editor/useEditorStore'
import { TutorialModal } from '@/components/TutorialModal'
import { EditorShowcaseTour } from '@/components/EditorShowcaseTour'
import {
  PENDING_NOTEBOOK_DELETION_KEY
} from '@/features/editor/constants'
import {
  cleanChatFormatting
} from '@/features/editor/lib/aiMessageText'
import type {
  AiHighlightRequest,
  NotebookPage
} from '@/features/editor/model/types'
import { DeleteNotebookModal } from '@/features/editor/components/DeleteNotebookModal'
import { EditorSettingsModal } from '@/features/editor/components/EditorSettingsModal'
import { AiAssistantPanel } from '@/features/editor/components/AiAssistantPanel'
import { EditorFileMenu } from '@/features/editor/components/EditorFileMenu'
import { EditorDocument } from '@/features/editor/components/EditorDocument'
import { useAiAssistant } from '@/features/editor/hooks/useAiAssistant'
import { useEditorPreferences } from '@/features/editor/hooks/useEditorPreferences'
import { usePageReordering } from '@/features/editor/hooks/usePageReordering'
import { useEditorTitles } from '@/features/editor/hooks/useEditorTitles'
import { EditorSidebar } from '@/features/editor/components/EditorSidebar'
import { useDeferredPageDeletion } from '@/features/editor/hooks/useDeferredPageDeletion'
import { useEditorSession } from '@/features/editor/hooks/useEditorSession'
import { usePageNavigation } from '@/features/editor/hooks/usePageNavigation'
import { useEditorExitSync } from '@/features/editor/hooks/useEditorExitSync'
import { useEditorFileTransfer } from '@/features/editor/hooks/useEditorFileTransfer'
import { useLocalMarkdownMirror } from '@/features/local-mirror/hooks/useLocalMarkdownMirror'
import {
  useNotebookMutationQueue,
  type RunNotebookMutation
} from '@/features/editor/hooks/useNotebookMutationQueue'

type Page = NotebookPage

export function EditorWorkspace({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const [mode, setMode] = useState<'read' | 'write'>('write')
  const [aiHighlightRequest, setAiHighlightRequest] =
    useState<AiHighlightRequest | null>(null)
  const preserveAiOnPageOpenRef = useRef(false)
  const runMutationRef = useRef<RunNotebookMutation>(
    (operation) => operation(0)
  )
  const {
    activePageIdRef,
    contentSaveTimeoutRef,
    error,
    ensureAllPagesLoaded,
    handleContentUpdate,
    isCreatingPageRef,
    lastSavedContentRef,
    loadPageById,
    loading,
    page,
    pageWarmup,
    pages,
    pendingContentRef,
    pendingCreatedPageRef,
    saveContentNow,
    selectedReadPageId,
    setPage,
    setPages,
    setSelectedReadPageId
  } = useEditorSession(params, runMutationRef)
  const notebookId =
    page?.notebook?.id || page?.notebook_id || null
  const {
    isMutating: isNotebookMutating,
    isStale: isNotebookStale,
    revision: notebookRevision,
    runMutation,
    settledMutationVersion
  } = useNotebookMutationQueue({
    notebookId,
    initialRevision: page?.notebook?.revision ?? 0
  })
  runMutationRef.current = runMutation
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showTutorialModal, setShowTutorialModal] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const notebookNameInputRef = useRef<HTMLInputElement>(null)
  const fileMenuRef = useRef<HTMLDivElement>(null)
  const openPageInPlaceRef = useRef<
    (
      page: Page,
      historyMode?: 'push' | 'replace'
    ) => void
  >(() => undefined)

  const router = useRouter()

  const {
    isBold,
    isItalic,
    isStrikethrough,
    isBulletList,
    isCodeBlock,
    isOrderedList,
    textColor,
    alignment,
    fontSize,
    fontFamily,

    setBold,
    setItalic,
    setStrikethrough,
    setBulletList,
    setCodeBlock,
    setOrderedList,
    setTextColor,
    setAlignment,
    setFontSize
  } = useEditorStore()

  const {
    darkEditorPaper,
    fontSizeInput,
    showEditorTour,
    completeEditorTour,
    setFontSizeInput,
    setIsFontSizeInputFocused,
    setPaperTheme,
    setShowEditorTour
  } = useEditorPreferences(page?.user_id, fontSize)

  const {
    isTitleFocused,
    handleNotebookNameBlur,
    handleNotebookNameChange,
    handlePageTitleBlur,
    handlePageTitleChange,
    handlePageTitleFocus,
    saveNotebookNameNow,
    savePageTitleNow,
    setIsTitleFocused
  } = useEditorTitles({
    page,
    setPage,
    setPages,
    pendingCreatedPageRef,
    runMutation
  })

  const saveCurrentEditorState = async () => {
    if (!page) return true
    if (page.isPendingCreation) return false

    if (!(await saveContentNow(page.id))) return false
    if (
      !(await savePageTitleNow(
        page.id,
        page.title?.trim() || 'Untitled Page'
      ))
    ) {
      return false
    }

    if (
      notebookId &&
      !(await saveNotebookNameNow(
        notebookId,
        page.notebook?.name?.trim() || 'My Notebook'
      ))
    ) {
      return false
    }

    return true
  }

  const {
    clearPendingDeletedPages,
    flushPendingDeletedPages,
    flushPendingDeletedPagesOnExit,
    getPendingDeletionPageIds
  } = useDeferredPageDeletion({
    contentSaveTimeoutRef,
    editorContainerRef,
    isCreatingPageRef,
    mode,
    openPage: (nextPage, historyMode) =>
      openPageInPlaceRef.current(nextPage, historyMode),
    page,
    pages,
    pendingContentRef,
    selectedReadPageId,
    setPages,
    setSelectedReadPageId,
    runMutation
  })

  const {
    draggedPageId,
    dragOverPageId,
    dragOverPosition,
    keyboardReorderStatus,
    clearPageDragState,
    handlePageDragOver,
    handlePageDragStart,
    handlePageDrop,
    handlePageKeyboardReorder
  } = usePageReordering({
    page,
    pages,
    setPages,
    getPendingDeletionPageIds,
    runMutation
  })

  useEditorExitSync(
    flushPendingDeletedPagesOnExit,
    () => {
      if (!page || page.isPendingCreation) return

      void saveCurrentEditorState()
    }
  )

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

  const {
    addedAiMessageIds,
    aiError,
    aiInsertRequest,
    aiMessages,
    aiMessagesEndRef,
    aiQuestion,
    aiReplaceRequest,
    aiSelection,
    aiTarget,
    isAskingAi,
    pendingPageReplaceId,
    replacedAiMessageIds,
    showAiPanel,
    askSentia,
    replaceWithAiMessage,
    setAddedAiMessageIds,
    setAiError,
    setAiInsertRequest,
    setAiMessages,
    setAiQuestion,
    setAiReplaceRequest,
    setAiSelection,
    setAiTarget,
    setPendingPageReplaceId,
    setReplacedAiMessageIds,
    setShowAiPanel
  } = useAiAssistant({ page, saveContentNow })

  const {
    exportCurrentNotebook,
    exportCurrentPage,
    finishImportReplacement,
    importIntoCurrentPage,
    importReplaceRequest,
    isTransferringFile
  } = useEditorFileTransfer({
    page,
    pendingContentRef,
    saveContentNow,
    setPage,
    setPages
  })

  const {
    connectOrSync: connectOrSyncLocalFolder,
    directoryName: localMirrorDirectoryName,
    disconnect: disconnectLocalFolder,
    error: localMirrorError,
    isConnected: isLocalMirrorConnected,
    status: localMirrorStatus
  } = useLocalMarkdownMirror({
    committedRevision: notebookRevision,
    isActive:
      !isNotebookStale &&
      !isNotebookMutating &&
      pageWarmup.complete,
    notebookId,
    notebookName: page?.notebook?.name || 'My Notebook',
    pages,
    settledMutationVersion
  })

  useEffect(() => {
    if (
      !isLocalMirrorConnected ||
      pageWarmup.complete
    ) {
      return
    }

    void ensureAllPagesLoaded()
  }, [
    ensureAllPagesLoaded,
    isLocalMirrorConnected,
    pageWarmup.complete
  ])

  const {
    handleNextPage,
    handlePageClick,
    handlePreviousPage,
    openPageById,
    openPageInPlace
  } = usePageNavigation({
    activePageIdRef,
    isCreatingPageRef,
    lastSavedContentRef,
    loadPageById,
    onPageOpened: () => {
      if (preserveAiOnPageOpenRef.current) {
        preserveAiOnPageOpenRef.current = false
        setAiSelection(null)
        setAiTarget('page')
        return
      }

      setAiHighlightRequest(null)
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
    },
    page,
    pages,
    pendingContentRef,
    pendingCreatedPageRef,
    runMutation,
    saveContentNow,
    savePageTitleNow,
    setIsTitleFocused,
    setPage,
    setPages,
    setSelectedReadPageId
  })

  openPageInPlaceRef.current = (nextPage, historyMode) => {
    if (
      nextPage.content !== undefined ||
      nextPage.isPendingCreation
    ) {
      openPageInPlace(nextPage, historyMode)
      return
    }

    void openPageById(nextPage.id, historyMode)
  }

  useEffect(() => {
    const handleEditorKeyboardNavigation = (
      event: KeyboardEvent
    ) => {
      if (
        showDeleteModal ||
        showSettingsModal ||
        showTutorialModal ||
        showEditorTour
      ) {
        return
      }

      const usesPrimaryModifier = event.ctrlKey || event.metaKey

      if (
        usesPrimaryModifier &&
        event.altKey &&
        event.shiftKey &&
        event.key.toLowerCase() === 'm'
      ) {
        event.preventDefault()
        document
          .querySelector<HTMLElement>(
            '[data-editor-keyboard-start="true"]'
          )
          ?.focus()
        return
      }

      if (
        event.altKey &&
        event.shiftKey &&
        ['ArrowLeft', 'ArrowRight'].includes(event.key)
      ) {
        event.preventDefault()

        if (event.key === 'ArrowLeft') {
          void handlePreviousPage()
        } else {
          void handleNextPage()
        }
      }
    }

    window.addEventListener(
      'keydown',
      handleEditorKeyboardNavigation
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleEditorKeyboardNavigation
      )
    }
  }, [
    handleNextPage,
    handlePreviousPage,
    showDeleteModal,
    showEditorTour,
    showSettingsModal,
    showTutorialModal
  ])

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

  const handleCodeBlockClick = (
    e: React.MouseEvent
  ) => {
    handleSidebarAction(
      () => setCodeBlock(!isCodeBlock),
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
    e?: React.MouseEvent
  ) => {
    e?.preventDefault()
    e?.stopPropagation()

    if (page) {
      const saved = await saveCurrentEditorState()

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
    e?: React.MouseEvent
  ) => {
    e?.preventDefault()
    e?.stopPropagation()

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
      const saved = await saveCurrentEditorState()

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

      clearPendingDeletedPages()
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
        className={styles.loadingContainer}
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
            className={styles.loadingCard}
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
              className={styles.loadingSpinner}
              style={{
                position: 'absolute',
                inset: '15px',
                borderRadius: '9999px',
                border: '2px solid #374151',
                borderTopColor: '#3b82f6',
                animation:
                  'sentia-spin 0.8s linear infinite'
              }}
            />
          </div>

          <h1
            className={styles.loadingText}
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
            className={styles.loadingSubtext}
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
                className={styles.loadingDot}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '9999px',
                  background: '#3b82f6',
                  animation:
                    'sentia-pulse 1.2s ease-in-out infinite',
                  animationDelay: `${delay}ms`
                }}
              />
            ))}
          </div>

          <style jsx>{`
            @keyframes sentia-spin {
              to {
                transform: rotate(360deg);
              }
            }

            @keyframes sentia-pulse {
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
      {isNotebookStale && (
        <div
          className={styles.staleNotebookOverlay}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="stale-notebook-title"
        >
          <div className={styles.staleNotebookCard}>
            <h2 id="stale-notebook-title">
              Newer version available
            </h2>
            <p>
              There is a newer version available. Please refresh
              before editing.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              autoFocus
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      <EditorSidebar
        alignment={alignment}
        dragOverPageId={dragOverPageId}
        dragOverPosition={dragOverPosition}
        draggedPageId={draggedPageId}
        keyboardReorderStatus={keyboardReorderStatus}
        fontFamily={fontFamily}
        fontSizeInput={fontSizeInput}
        isBold={isBold}
        isBulletList={isBulletList}
        isCodeBlock={isCodeBlock}
        isItalic={isItalic}
        isOrderedList={isOrderedList}
        isStrikethrough={isStrikethrough}
        mode={mode}
        notebookNameInputRef={notebookNameInputRef}
        page={page}
        pageWarmup={pageWarmup}
        pages={pages}
        selectedReadPageId={selectedReadPageId}
        textColor={textColor}
        onAlignmentClick={handleAlignmentClick}
        onBoldClick={handleBoldClick}
        onColorChange={handleColorChange}
        onCodeBlockClick={handleCodeBlockClick}
        onDragEnd={clearPageDragState}
        onFontSizeBlur={handleFontSizeBlur}
        onFontSizeChange={handleFontSizeChange}
        onFontSizeFocus={(event) => {
          setIsFontSizeInputFocused(true)
          event.currentTarget.select()
        }}
        onItalicClick={handleItalicClick}
        onListClick={handleListClick}
        onModeChange={handleModeChange}
        onNotebookNameBlur={handleNotebookNameBlur}
        onNotebookNameChange={handleNotebookNameChange}
        onPageClick={(pageId) => void handlePageClick(pageId)}
        onPageDragOver={handlePageDragOver}
        onPageDragStart={handlePageDragStart}
        onPageDrop={handlePageDrop}
        onPageKeyboardReorder={(pageId, direction) => {
          void handlePageKeyboardReorder(pageId, direction)
        }}
        onStrikeClick={handleStrikeClick}
        fileMenu={
          <EditorFileMenu
            containerRef={fileMenuRef}
            isDeletingNotebook={isDeletingNotebook}
            isLocalMirrorConnected={isLocalMirrorConnected}
            isTransferringFile={isTransferringFile}
            isOpen={showFileMenu}
            localMirrorDirectoryName={localMirrorDirectoryName}
            localMirrorError={localMirrorError}
            localMirrorStatus={localMirrorStatus}
            onConnectLocalFolder={() => {
              void saveCurrentEditorState().then(
                async (saved) => {
                  if (!saved) return

                  const allPagesLoaded =
                    await ensureAllPagesLoaded()
                  if (!allPagesLoaded) {
                    window.alert(
                      'Sentia could not finish loading this notebook for local sync. Please try again.'
                    )
                    return
                  }

                  return connectOrSyncLocalFolder()
                }
              )
            }}
            onDeleteNotebook={() => {
              setShowFileMenu(false)
              handleDeleteNotebookClick()
            }}
            onDisconnectLocalFolder={() => {
              void disconnectLocalFolder()
            }}
            onGoHome={() => {
              setShowFileMenu(false)
              void handleHomeClick()
            }}
            onImportFile={(file) => {
              setShowFileMenu(false)
              void importIntoCurrentPage(file)
            }}
            onExportPage={(format) => {
              setShowFileMenu(false)
              void exportCurrentPage(format)
            }}
            onExportNotebook={(format) => {
              setShowFileMenu(false)
              void exportCurrentNotebook(format)
            }}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenStudyQuiz={() => {
              const notebookId =
                page.notebook?.id || page.notebook_id
              if (!notebookId) return
              setShowFileMenu(false)
              void saveCurrentEditorState().then((saved) => {
                if (saved) {
                  router.push(
                    `/quiz/${notebookId}?pageId=${encodeURIComponent(
                      page.id
                    )}`
                  )
                }
              })
            }}
            onRenameNotebook={handleRenameNotebookClick}
            onToggle={() =>
              setShowFileMenu((isOpen) => !isOpen)
            }
          />
        }
      />

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
          <EditorDocument
            canGoNext={canUseNextButton}
            canGoPrevious={hasPreviousPage}
            darkPaper={darkEditorPaper}
            hasNextPage={hasNextPage}
            highlightRequest={aiHighlightRequest}
            insertRequest={aiInsertRequest}
            isTitleFocused={isTitleFocused}
            page={page}
            replaceRequest={
              importReplaceRequest ?? aiReplaceRequest
            }
            onContentMouseDown={handleContentAreaMouseDown}
            onContentUpdate={handleContentUpdate}
            onNextPage={() => void handleNextPage()}
            onPreviousPage={() => void handlePreviousPage()}
            onReplaceResult={(messageId, applied) => {
              if (
                finishImportReplacement(messageId, applied)
              ) {
                return
              }

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
            onSelectionChange={(selection) => {
              setAiSelection(selection)
              setAiTarget(selection ? 'selection' : 'page')
            }}
            onTitleBlur={handlePageTitleBlur}
            onTitleChange={handlePageTitleChange}
            onTitleFocus={handlePageTitleFocus}
          />

          {showAiPanel && (
            <AiAssistantPanel
              addedMessageIds={addedAiMessageIds}
              error={aiError}
              isAsking={isAskingAi}
              messages={aiMessages}
              messagesEndRef={aiMessagesEndRef}
              pendingPageReplaceId={pendingPageReplaceId}
              question={aiQuestion}
              replacedMessageIds={replacedAiMessageIds}
              selection={aiSelection}
              target={aiTarget}
              onAction={(action) => void askSentia(action)}
              onAddToPage={(message) => {
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
              onCancelPageReplace={() =>
                setPendingPageReplaceId(null)
              }
              onClose={() => setShowAiPanel(false)}
              onOpenCitation={(citation) => {
                void (async () => {
                  const sourcePage = pages.find(
                    (candidate) =>
                      candidate.id === citation.pageId
                  )

                  if (!sourcePage) return

                  const changesPage = page.id !== sourcePage.id
                  preserveAiOnPageOpenRef.current = changesPage
                  const opened = await handlePageClick(sourcePage.id)

                  if (!opened) {
                    preserveAiOnPageOpenRef.current = false
                    return
                  }

                  setShowAiPanel(true)
                  setAiHighlightRequest({
                    id: crypto.randomUUID(),
                    text:
                      citation.selectionText ||
                      citation.excerpt
                  })
                })()
              }}
              onQuestionChange={setAiQuestion}
              onReplace={replaceWithAiMessage}
              onTargetChange={setAiTarget}
            />
          )}
        </div>

      </div>

      {showDeleteModal && (
        <DeleteNotebookModal
          error={deleteError}
          isDeleting={isDeletingNotebook}
          onCancel={handleCancelDeleteNotebook}
          onConfirm={handleConfirmDeleteNotebook}
        />
      )}

      {showSettingsModal && (
        <EditorSettingsModal
          darkEditorPaper={darkEditorPaper}
          onClose={() => setShowSettingsModal(false)}
          onOpenTutorial={() => {
            setShowSettingsModal(false)
            setShowTutorialModal(true)
          }}
          onReplayEditorTour={() => {
            setShowSettingsModal(false)
            setShowEditorTour(true)
          }}
          onThemeChange={setPaperTheme}
        />
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
        onComplete={completeEditorTour}
      />
    </div>
  )
}
