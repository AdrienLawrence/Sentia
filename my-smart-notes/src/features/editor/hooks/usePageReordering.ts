'use client'

import { useRef, useState } from 'react'

import type { NotebookPage } from '../model/types'
import type { RunNotebookMutation } from './useNotebookMutationQueue'

interface UsePageReorderingOptions {
  page: NotebookPage | null
  pages: NotebookPage[]
  setPages: React.Dispatch<React.SetStateAction<NotebookPage[]>>
  getPendingDeletionPageIds: () => string[]
  runMutation: RunNotebookMutation
}

export function usePageReordering({
  page,
  pages,
  setPages,
  getPendingDeletionPageIds,
  runMutation
}: UsePageReorderingOptions) {
  const [keyboardReorderStatus, setKeyboardReorderStatus] =
    useState('')
  const [draggedPageId, setDraggedPageId] =
    useState<string | null>(null)
  const [dragOverPageId, setDragOverPageId] =
    useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] =
    useState<'before' | 'after' | null>(null)
  const reorderOperationRef = useRef(0)

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

  const savePageOrder = async (
    numberedPages: NotebookPage[],
    originalPages: NotebookPage[]
  ) => {
    const operationId = reorderOperationRef.current + 1
    reorderOperationRef.current = operationId
    setPages(numberedPages)

    const notebookId =
      page?.notebook?.id || page?.notebook_id

    if (!notebookId) {
      if (reorderOperationRef.current === operationId) {
        setPages(originalPages)
      }
      return false
    }

    try {
      const response = await runMutation(
        (expectedRevision) =>
          fetch(`/api/notebooks/${notebookId}/pages`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pageIds: numberedPages.map(
                (listedPage) => listedPage.id
              ),
              pendingDeletionPageIds:
                getPendingDeletionPageIds(),
              expectedRevision
            })
          })
      )

      if (!response.ok) {
        throw new Error('Failed to reorder pages')
      }

      if (reorderOperationRef.current === operationId) {
        setPages(numberedPages)
      }
      return true
    } catch (error) {
      console.error('Failed to reorder pages:', error)
      if (reorderOperationRef.current === operationId) {
        setPages(originalPages)
      }
      window.alert('Failed to reorder pages.')
      return false
    }
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

    reorderedPages.splice(insertionIndex, 0, draggedPage)

    const numberedPages = reorderedPages.map(
      (listedPage, index) => ({
        ...listedPage,
        page_number: index + 1
      })
    )

    clearPageDragState()
    await savePageOrder(numberedPages, originalPages)
  }

  const handlePageKeyboardReorder = async (
    pageId: string,
    direction: 'up' | 'down'
  ) => {
    const originalPages = pages
    const currentIndex = pages.findIndex(
      (listedPage) => listedPage.id === pageId
    )
    const nextIndex =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (
      currentIndex === -1 ||
      nextIndex < 0 ||
      nextIndex >= pages.length
    ) {
      setKeyboardReorderStatus(
        direction === 'up'
          ? 'This page is already first.'
          : 'This page is already last.'
      )
      return
    }

    const reorderedPages = [...pages]
    const [movedPage] = reorderedPages.splice(currentIndex, 1)
    reorderedPages.splice(nextIndex, 0, movedPage)

    const numberedPages = reorderedPages.map(
      (listedPage, index) => ({
        ...listedPage,
        page_number: index + 1
      })
    )

    setKeyboardReorderStatus('')
    const saved = await savePageOrder(
      numberedPages,
      originalPages
    )

    if (saved) {
      setKeyboardReorderStatus(
        `${movedPage.title || 'Untitled Page'} moved to position ${
          nextIndex + 1
        }.`
      )
    }
  }

  return {
    draggedPageId,
    dragOverPageId,
    dragOverPosition,
    keyboardReorderStatus,
    clearPageDragState,
    handlePageDragOver,
    handlePageDragStart,
    handlePageDrop,
    handlePageKeyboardReorder
  }
}
