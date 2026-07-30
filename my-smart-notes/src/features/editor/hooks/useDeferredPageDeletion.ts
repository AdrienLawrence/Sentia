'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { JSONContent } from '@tiptap/core'

import type {
  DeletedPageEntry,
  NotebookPage
} from '../model/types'
import type { RunNotebookMutation } from './useNotebookMutationQueue'

interface UseDeferredPageDeletionOptions {
  contentSaveTimeoutRef: React.MutableRefObject<
    ReturnType<typeof setTimeout> | null
  >
  editorContainerRef: React.RefObject<HTMLDivElement | null>
  isCreatingPageRef: React.MutableRefObject<boolean>
  mode: 'read' | 'write'
  openPage: (
    page: NotebookPage,
    historyMode?: 'push' | 'replace'
  ) => void
  page: NotebookPage | null
  pages: NotebookPage[]
  pendingContentRef: React.MutableRefObject<JSONContent | null>
  selectedReadPageId: string | null
  setPages: React.Dispatch<React.SetStateAction<NotebookPage[]>>
  setSelectedReadPageId: React.Dispatch<
    React.SetStateAction<string | null>
  >
  runMutation: RunNotebookMutation
}

export function useDeferredPageDeletion({
  contentSaveTimeoutRef,
  editorContainerRef,
  isCreatingPageRef,
  mode,
  openPage,
  page,
  pages,
  pendingContentRef,
  selectedReadPageId,
  setPages,
  setSelectedReadPageId,
  runMutation
}: UseDeferredPageDeletionOptions) {
  const deleteSurfaceActiveRef = useRef(false)
  const deletedPagesStackRef = useRef<DeletedPageEntry[]>([])

  const getPendingDeletionPageIds = () =>
    deletedPagesStackRef.current.map((entry) => entry.page.id)

  const clearPendingDeletedPages = () => {
    deletedPagesStackRef.current = []
  }

  const flushPendingDeletedPagesOnExit = () => {
    const pendingDeletions = [...deletedPagesStackRef.current]
    deletedPagesStackRef.current = []

    pendingDeletions.forEach((entry) => {
      void runMutation((expectedRevision) =>
        fetch(`/api/pages/${entry.page.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedRevision }),
          keepalive: true
        })
      ).catch((error) => {
          console.error(
            'Failed to delete page while leaving editor:',
            error
          )
        })
    })
  }

  const commitDeletedPage = async (
    pageToDelete: NotebookPage,
    originalIndex: number
  ) => {
    try {
      const response = await runMutation(
        (expectedRevision) =>
          fetch(`/api/pages/${pageToDelete.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expectedRevision })
          })
      )

      if (!response.ok) {
        let message = 'Failed to delete page.'

        try {
          const body = await response.json()
          if (body && typeof body.error === 'string') {
            message = body.error
          }
        } catch {
          // Keep the fallback message.
        }

        throw new Error(message)
      }

      deletedPagesStackRef.current =
        deletedPagesStackRef.current.filter(
          (entry) => entry.page.id !== pageToDelete.id
        )
      return true
    } catch (error) {
      console.error('Failed to delete page:', error)
      deletedPagesStackRef.current =
        deletedPagesStackRef.current.filter(
          (entry) => entry.page.id !== pageToDelete.id
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
        restoredPages.splice(
          Math.min(originalIndex, restoredPages.length),
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
    const results = await Promise.all(
      [...deletedPagesStackRef.current].map((entry) =>
        commitDeletedPage(entry.page, entry.originalIndex)
      )
    )
    return results.every(Boolean)
  }

  const deletePageById = useCallback((pageId: string) => {
    if (pages.length <= 1 || isCreatingPageRef.current) return

    const pageIndex = pages.findIndex(
      (currentPage) => currentPage.id === pageId
    )
    if (pageIndex === -1) return

    const pageToDelete = pages[pageIndex]
    if (pageToDelete.isPendingCreation) return

    const fallbackPage =
      pages[pageIndex + 1] || pages[pageIndex - 1]
    if (!fallbackPage) return

    if (page?.id === pageId) {
      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current)
        contentSaveTimeoutRef.current = null
      }
      pendingContentRef.current = null
      openPage(fallbackPage, 'replace')
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
  }, [
    contentSaveTimeoutRef,
    isCreatingPageRef,
    openPage,
    page,
    pages,
    pendingContentRef,
    setPages,
    setSelectedReadPageId
  ])

  const restoreLastDeletedPage = useCallback(() => {
    const entry = deletedPagesStackRef.current.pop()
    if (!entry) return

    setPages((currentPages) => {
      if (
        currentPages.some(
          (currentPage) => currentPage.id === entry.page.id
        )
      ) {
        return currentPages
      }

      const restoredPages = [...currentPages]
      restoredPages.splice(
        Math.min(entry.originalIndex, restoredPages.length),
        0,
        entry.page
      )
      return restoredPages
    })

    openPage(entry.page, 'replace')
    setSelectedReadPageId(entry.page.id)
    deleteSurfaceActiveRef.current = true
  }, [openPage, setPages, setSelectedReadPageId])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof HTMLElement)) {
        deleteSurfaceActiveRef.current = false
        return
      }

      const insideEditor =
        editorContainerRef.current?.contains(target) ?? false
      const editable = Boolean(
        target.closest(
          'input, textarea, select, button, [contenteditable="true"], .ProseMirror'
        )
      )
      deleteSurfaceActiveRef.current = insideEditor && !editable
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const insideEditable =
        target instanceof HTMLElement &&
        Boolean(
          target.closest(
            'input, textarea, select, [contenteditable="true"], .ProseMirror'
          )
        )
      const undo =
        event.key.toLowerCase() === 'z' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey

      if (undo) {
        if (!insideEditable && deletedPagesStackRef.current.length) {
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
        event.shiftKey ||
        insideEditable
      ) {
        return
      }

      const pageId =
        mode === 'read'
          ? selectedReadPageId || page?.id
          : deleteSurfaceActiveRef.current
            ? page?.id
            : null

      if (!pageId || pages.length <= 1) return
      event.preventDefault()
      deletePageById(pageId)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown,
        true
      )
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    deletePageById,
    editorContainerRef,
    mode,
    page,
    pages,
    restoreLastDeletedPage,
    selectedReadPageId
  ])

  return {
    clearPendingDeletedPages,
    flushPendingDeletedPages,
    flushPendingDeletedPagesOnExit,
    getPendingDeletionPageIds
  }
}
