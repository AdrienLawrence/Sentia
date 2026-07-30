'use client'

import { useEffect, useRef, useState } from 'react'

import type { NotebookPage } from '../model/types'
import type { RunNotebookMutation } from './useNotebookMutationQueue'

interface UseEditorTitlesOptions {
  page: NotebookPage | null
  setPage: React.Dispatch<
    React.SetStateAction<NotebookPage | null>
  >
  setPages: React.Dispatch<
    React.SetStateAction<NotebookPage[]>
  >
  pendingCreatedPageRef: React.MutableRefObject<
    NotebookPage | null
  >
  runMutation: RunNotebookMutation
}

export function useEditorTitles({
  page,
  setPage,
  setPages,
  pendingCreatedPageRef,
  runMutation
}: UseEditorTitlesOptions) {
  const [isTitleFocused, setIsTitleFocused] = useState(false)
  const notebookNameSaveTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageTitleSaveTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedNotebookNameRef = useRef<string | null>(null)
  const loadedNotebookIdRef = useRef<string | null>(null)
  const pendingNotebookNameRef = useRef<string | null>(null)
  const notebookNameSaveInFlightRef =
    useRef<Promise<boolean> | null>(null)
  const pageTitleSaveStatesRef = useRef(
    new Map<
      string,
      {
        inFlight: Promise<boolean> | null
        lastSaved: string | null
        latest: string
      }
    >()
  )

  useEffect(() => {
    if (
      page?.notebook?.id &&
      page.notebook.id !== loadedNotebookIdRef.current
    ) {
      loadedNotebookIdRef.current = page.notebook.id
      lastSavedNotebookNameRef.current = page.notebook.name
      pendingNotebookNameRef.current = null
    }
  }, [page?.notebook?.id, page?.notebook?.name])

  useEffect(() => {
    if (!page || page.isPendingCreation) return

    const existing = pageTitleSaveStatesRef.current.get(page.id)
    if (!existing) {
      pageTitleSaveStatesRef.current.set(page.id, {
        inFlight: null,
        lastSaved: page.title ?? '',
        latest: page.title ?? ''
      })
    }
  }, [page])

  useEffect(() => {
    const warnAboutUnsavedTitles = (
      event: BeforeUnloadEvent
    ) => {
      const hasPendingPageTitle = Array.from(
        pageTitleSaveStatesRef.current.values()
      ).some(
        (state) =>
          state.inFlight !== null ||
          state.latest !== state.lastSaved
      )
      const hasPendingNotebookName =
        notebookNameSaveInFlightRef.current !== null ||
        pendingNotebookNameRef.current !== null

      if (!hasPendingPageTitle && !hasPendingNotebookName) return

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener(
      'beforeunload',
      warnAboutUnsavedTitles
    )
    return () =>
      window.removeEventListener(
        'beforeunload',
        warnAboutUnsavedTitles
      )
  }, [])

  const setNotebookNameLocally = (name: string) => {
    const notebookId =
      page?.notebook?.id || page?.notebook_id

    setPage((currentPage) =>
      currentPage?.notebook
        ? {
            ...currentPage,
            notebook: { ...currentPage.notebook, name }
          }
        : currentPage
    )

    setPages((currentPages) =>
      currentPages.map((currentPage) =>
        currentPage.notebook &&
        currentPage.notebook.id === notebookId
          ? {
              ...currentPage,
              notebook: { ...currentPage.notebook, name }
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

    pendingNotebookNameRef.current = name

    if (!notebookNameSaveInFlightRef.current) {
      const worker = async () => {
        while (
          pendingNotebookNameRef.current !== null &&
          pendingNotebookNameRef.current !==
            lastSavedNotebookNameRef.current
        ) {
          const nextName = pendingNotebookNameRef.current

          try {
            const response = await runMutation(
              (expectedRevision) =>
                fetch(`/api/notebooks/${notebookId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: nextName,
                    expectedRevision
                  })
                })
            )

            if (!response.ok) {
              throw new Error(
                `Failed to save notebook name: ${response.status}`
              )
            }

            lastSavedNotebookNameRef.current = nextName
          } catch (error) {
            console.error('Failed to save notebook name:', error)
            const committedName =
              lastSavedNotebookNameRef.current || 'My Notebook'
            pendingNotebookNameRef.current = null
            setNotebookNameLocally(committedName)
            return false
          }
        }

        if (
          pendingNotebookNameRef.current ===
          lastSavedNotebookNameRef.current
        ) {
          pendingNotebookNameRef.current = null
        }
        return true
      }

      const task = worker()
      notebookNameSaveInFlightRef.current = task
      void task.finally(() => {
        if (notebookNameSaveInFlightRef.current === task) {
          notebookNameSaveInFlightRef.current = null
        }
      })
    }

    return notebookNameSaveInFlightRef.current
  }

  const savePageTitleNow = async (
    pageId: string,
    title: string
  ) => {
    if (pageTitleSaveTimeoutRef.current) {
      clearTimeout(pageTitleSaveTimeoutRef.current)
      pageTitleSaveTimeoutRef.current = null
    }

    const state =
      pageTitleSaveStatesRef.current.get(pageId) ?? {
        inFlight: null,
        lastSaved: null,
        latest: title
      }
    state.latest = title
    pageTitleSaveStatesRef.current.set(pageId, state)

    if (!state.inFlight) {
      const worker = async () => {
        while (state.latest !== state.lastSaved) {
          const nextTitle = state.latest

          try {
            const response = await runMutation(
              (expectedRevision) =>
                fetch(`/api/pages/${pageId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    title: nextTitle,
                    expectedRevision
                  })
                })
            )

            if (!response.ok) {
              throw new Error(
                `Failed to save page title: ${response.status}`
              )
            }

            const savedPage =
              (await response.json()) as Partial<NotebookPage>
            state.lastSaved = nextTitle
            setPage((currentPage) =>
              currentPage?.id === pageId
                ? {
                    ...currentPage,
                    updated_at:
                      savedPage.updated_at ??
                      currentPage.updated_at
                  }
                : currentPage
            )
            setPages((currentPages) =>
              currentPages.map((currentPage) =>
                currentPage.id === pageId
                  ? {
                      ...currentPage,
                      updated_at:
                        savedPage.updated_at ??
                        currentPage.updated_at
                    }
                  : currentPage
              )
            )
          } catch (error) {
            console.error('Failed to save page title:', error)
            const committedTitle =
              state.lastSaved?.trim() || 'Untitled Page'
            state.latest = committedTitle
            setPage((currentPage) =>
              currentPage?.id === pageId
                ? {
                    ...currentPage,
                    title: committedTitle
                  }
                : currentPage
            )
            setPages((currentPages) =>
              currentPages.map((currentPage) =>
                currentPage.id === pageId
                  ? {
                      ...currentPage,
                      title: committedTitle
                    }
                  : currentPage
              )
            )
            return false
          }
        }

        return true
      }

      const task = worker()
      state.inFlight = task
      void task.finally(() => {
        if (state.inFlight === task) state.inFlight = null
      })
    }

    return state.inFlight
  }

  const handleNotebookNameChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const notebookId =
      page?.notebook?.id || page?.notebook_id
    const name = event.target.value

    setNotebookNameLocally(name)
    pendingNotebookNameRef.current =
      name.trim() || 'My Notebook'
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
    event: React.FocusEvent<HTMLInputElement>
  ) => {
    if (!page) return

    const notebookId =
      page.notebook?.id || page.notebook_id
    if (!notebookId) return

    const name =
      event.currentTarget.value.trim() || 'My Notebook'

    setNotebookNameLocally(name)
    void saveNotebookNameNow(notebookId, name)
  }

  const handlePageTitleFocus = (
    event: React.FocusEvent<HTMLInputElement>
  ) => {
    setIsTitleFocused(true)

    if (
      event.currentTarget.value.trim().toLowerCase() ===
      'untitled page'
    ) {
      event.currentTarget.select()
    }
  }

  const handlePageTitleBlur = (
    event: React.FocusEvent<HTMLInputElement>
  ) => {
    setIsTitleFocused(false)
    if (!page) return

    const enteredTitle = event.currentTarget.value.trim()
    if (enteredTitle) {
      if (!page.isPendingCreation) {
        void savePageTitleNow(page.id, enteredTitle)
      }
      return
    }

    const fallbackTitle = 'Untitled Page'

    setPage((currentPage) =>
      currentPage
        ? { ...currentPage, title: fallbackTitle }
        : currentPage
    )
    setPages((currentPages) =>
      currentPages.map((currentPage) =>
        currentPage.id === page.id
          ? { ...currentPage, title: fallbackTitle }
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

    void savePageTitleNow(page.id, fallbackTitle)
  }

  const handlePageTitleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!page) return
    const title = event.target.value

    setPage((currentPage) =>
      currentPage ? { ...currentPage, title } : currentPage
    )
    setPages((currentPages) =>
      currentPages.map((currentPage) =>
        currentPage.id === page.id
          ? { ...currentPage, title }
          : currentPage
      )
    )

    if (page.isPendingCreation) {
      pendingCreatedPageRef.current = {
        ...(pendingCreatedPageRef.current || page),
        title
      }
      return
    }

    if (pageTitleSaveTimeoutRef.current) {
      clearTimeout(pageTitleSaveTimeoutRef.current)
    }
    const pageId = page.id
    pageTitleSaveTimeoutRef.current = setTimeout(() => {
      void savePageTitleNow(
        pageId,
        title.trim() || 'Untitled Page'
      )
    }, 750)
  }

  return {
    isTitleFocused,
    handleNotebookNameBlur,
    handleNotebookNameChange,
    handlePageTitleBlur,
    handlePageTitleChange,
    handlePageTitleFocus,
    saveNotebookNameNow,
    savePageTitleNow,
    setIsTitleFocused
  }
}
