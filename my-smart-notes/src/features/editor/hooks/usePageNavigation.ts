'use client'

import type { JSONContent } from '@tiptap/core'

import {
  markNotebookOpenedInSessionCache
} from '@/features/dashboard/lib/notebookSessionCache'
import type { NotebookPage } from '../model/types'
import type { RunNotebookMutation } from './useNotebookMutationQueue'

interface UsePageNavigationOptions {
  activePageIdRef: React.MutableRefObject<string | null>
  isCreatingPageRef: React.MutableRefObject<boolean>
  lastSavedContentRef: React.MutableRefObject<string | null>
  loadPageById: (
    pageId: string
  ) => Promise<NotebookPage | null>
  onPageOpened: () => void
  page: NotebookPage | null
  pages: NotebookPage[]
  pendingContentRef: React.MutableRefObject<JSONContent | null>
  pendingCreatedPageRef: React.MutableRefObject<NotebookPage | null>
  saveContentNow: (pageId: string) => Promise<boolean>
  savePageTitleNow: (
    pageId: string,
    title: string
  ) => Promise<boolean | null>
  runMutation: RunNotebookMutation
  setIsTitleFocused: (focused: boolean) => void
  setPage: React.Dispatch<
    React.SetStateAction<NotebookPage | null>
  >
  setPages: React.Dispatch<
    React.SetStateAction<NotebookPage[]>
  >
  setSelectedReadPageId: React.Dispatch<
    React.SetStateAction<string | null>
  >
}

export function usePageNavigation({
  activePageIdRef,
  isCreatingPageRef,
  lastSavedContentRef,
  loadPageById,
  onPageOpened,
  page,
  pages,
  pendingContentRef,
  pendingCreatedPageRef,
  saveContentNow,
  savePageTitleNow,
  runMutation,
  setIsTitleFocused,
  setPage,
  setPages,
  setSelectedReadPageId
}: UsePageNavigationOptions) {
  const saveCurrentPage = async () => {
    if (!page || page.isPendingCreation) return true

    const contentSaved = await saveContentNow(page.id)
    if (!contentSaved) return false

    return Boolean(
      await savePageTitleNow(
        page.id,
        page.title?.trim() || 'Untitled Page'
      )
    )
  }

  const openPageInPlace = (
    targetPage: NotebookPage,
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
    onPageOpened()

    if (targetPage.isPendingCreation) return

    const nextUrl = `/editor/${targetPage.id}`
    window.history[
      historyMode === 'replace' ? 'replaceState' : 'pushState'
    ]({}, '', nextUrl)
  }

  const openPageById = async (
    pageId: string,
    historyMode: 'push' | 'replace' = 'push'
  ) => {
    const targetPage = pages.find(
      (currentPage) => currentPage.id === pageId
    )
    if (!targetPage) return false

    try {
      const hydratedPage =
        targetPage.content !== undefined ||
        targetPage.isPendingCreation
          ? targetPage
          : await loadPageById(pageId)

      if (!hydratedPage) {
        throw new Error('Page content was not found')
      }

      openPageInPlace(
        {
          ...targetPage,
          ...hydratedPage,
          notebook:
            hydratedPage.notebook ?? targetPage.notebook
        },
        historyMode
      )
      return true
    } catch (loadError) {
      console.error('Failed to open page:', loadError)
      window.alert('This page could not be loaded. Please try again.')
      return false
    }
  }

  const handlePageClick = async (pageId: string) => {
    setSelectedReadPageId(pageId)
    if (!page) return false
    if (pageId === page.id) return true

    if (await saveCurrentPage()) {
      return openPageById(pageId)
    }

    return false
  }

  const handlePreviousPage = async () => {
    if (!page || pages.length === 0) return
    const currentIndex = pages.findIndex(
      (currentPage) => currentPage.id === page.id
    )
    if (currentIndex <= 0) return

    if (await saveCurrentPage()) {
      await openPageById(pages[currentIndex - 1].id)
    }
  }

  const handleNextPage = async () => {
    if (!page || !pages.length || isCreatingPageRef.current) {
      return
    }

    const currentIndex = pages.findIndex(
      (currentPage) => currentPage.id === page.id
    )
    if (currentIndex === -1) return
    if (!(await saveCurrentPage())) return
    if (isCreatingPageRef.current) return

    if (currentIndex < pages.length - 1) {
      await openPageById(pages[currentIndex + 1].id)
      return
    }

    const notebookId =
      page.notebook?.id || page.notebook_id
    if (!notebookId) return

    isCreatingPageRef.current = true
    const temporaryPageId = `temp-${crypto.randomUUID()}`
    const temporaryPage: NotebookPage = {
      id: temporaryPageId,
      editorKey: temporaryPageId,
      title: 'Untitled Page',
      content: { type: 'doc', content: [] },
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

    let createdPage: NotebookPage | null = null

    try {
      const response = await runMutation(
        (expectedRevision) =>
          fetch(`/api/notebooks/${notebookId}/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Untitled Page',
              content: { type: 'doc', content: [] },
              expectedRevision
            })
          })
      )
      if (!response.ok) {
        throw new Error(
          `Failed to create page: ${response.status}`
        )
      }

      createdPage = (await response.json()) as NotebookPage

      if (createdPage.user_id && createdPage.notebook_id) {
        markNotebookOpenedInSessionCache(
          createdPage.user_id,
          createdPage.notebook_id,
          new Date().toISOString(),
          createdPage.id
        )
      }

      let savedSnapshot = pendingCreatedPageRef.current || temporaryPage

      while (true) {
        const flushResponse = await runMutation(
          (expectedRevision) =>
            fetch(`/api/pages/${createdPage!.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                title:
                  savedSnapshot.title?.trim() || 'Untitled Page',
                content: savedSnapshot.content,
                expectedRevision
              })
            })
        )

        if (!flushResponse.ok) {
          throw new Error(
            `Page was created but initial edits failed to save: ${flushResponse.status}`
          )
        }

        const latestSnapshot =
          pendingCreatedPageRef.current || savedSnapshot
        if (
          latestSnapshot.title === savedSnapshot.title &&
          JSON.stringify(latestSnapshot.content) ===
            JSON.stringify(savedSnapshot.content)
        ) {
          savedSnapshot = latestSnapshot
          break
        }
        savedSnapshot = latestSnapshot
      }

      const resolvedPage: NotebookPage = {
        ...createdPage,
        editorKey: savedSnapshot.editorKey,
        title: savedSnapshot.title,
        content: savedSnapshot.content,
        notebook: createdPage.notebook || page.notebook,
        notebook_id: createdPage.notebook_id || notebookId,
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

      if (activePageIdRef.current === temporaryPageId) {
        activePageIdRef.current = createdPage.id
        window.history.pushState(
          {},
          '',
          `/editor/${createdPage.id}`
        )
      }

      lastSavedContentRef.current = JSON.stringify(
        resolvedPage.content ?? null
      )
      pendingContentRef.current = null
      pendingCreatedPageRef.current = null
    } catch (error) {
      console.error('Failed to create next page:', error)
      const fallbackPage = pages[currentIndex] || page

      if (createdPage) {
        const latest =
          pendingCreatedPageRef.current || temporaryPage
        const recoverablePage: NotebookPage = {
          ...createdPage,
          editorKey: latest.editorKey,
          title: latest.title,
          content: latest.content,
          notebook: createdPage.notebook || page.notebook,
          notebook_id: createdPage.notebook_id || notebookId,
          isPendingCreation: false
        }

        setPages((currentPages) =>
          currentPages.map((currentPage) =>
            currentPage.id === temporaryPageId
              ? recoverablePage
              : currentPage
          )
        )
        setPage((currentPage) =>
          currentPage?.id === temporaryPageId
            ? recoverablePage
            : currentPage
        )
        activePageIdRef.current = createdPage.id
        pendingContentRef.current = latest.content ?? null
        window.history.replaceState(
          {},
          '',
          `/editor/${createdPage.id}`
        )
        window.alert(
          'The page was created, but its latest edits are still unsaved.'
        )
        return
      }

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

      if (activePageIdRef.current === temporaryPageId) {
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

  return {
    handleNextPage,
    handlePageClick,
    handlePreviousPage,
    openPageById,
    openPageInPlace
  }
}
