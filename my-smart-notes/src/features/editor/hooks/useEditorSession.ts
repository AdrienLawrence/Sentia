'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import type { JSONContent } from '@tiptap/core'

import type { NotebookPage } from '../model/types'
import type { RunNotebookMutation } from './useNotebookMutationQueue'
import {
  markNotebookOpenedInSessionCache
} from '@/features/dashboard/lib/notebookSessionCache'

const PAGE_WARMUP_BATCH_SIZE = 8

export function useEditorSession(
  params: Promise<{ id: string }>,
  runMutationRef: React.MutableRefObject<RunNotebookMutation>
) {
  const [page, setPage] = useState<NotebookPage | null>(null)
  const [pages, setPages] = useState<NotebookPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageDirectoryLoaded, setPageDirectoryLoaded] =
    useState(false)
  const [selectedReadPageId, setSelectedReadPageId] =
    useState<string | null>(null)
  const contentSaveTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContentRef = useRef<string | null>(null)
  const pendingContentRef = useRef<JSONContent | null>(null)
  const isCreatingPageRef = useRef(false)
  const pendingCreatedPageRef =
    useRef<NotebookPage | null>(null)
  const activePageIdRef = useRef<string | null>(null)
  const contentSaveInFlightRef =
    useRef<Promise<boolean> | null>(null)
  const pagesRef = useRef<NotebookPage[]>([])
  const notebookIdRef = useRef<string | null>(null)
  const notebookRef =
    useRef<NotebookPage['notebook']>(undefined)
  const pageLoadPromisesRef = useRef(
    new Map<string, Promise<NotebookPage | null>>()
  )
  const initializationPageIdRef = useRef<string | null>(null)
  const warmupGenerationRef = useRef(0)
  const cleanupTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  const mergeLoadedPages = useCallback(
    (loadedPages: NotebookPage[]) => {
      if (loadedPages.length === 0) return

      const loadedById = new Map(
        loadedPages.map((loadedPage) => [
          loadedPage.id,
          loadedPage
        ])
      )

      setPages((currentPages) => {
        const nextPages = currentPages.map((currentPage) => {
          const loadedPage = loadedById.get(currentPage.id)
          if (!loadedPage) return currentPage

          return {
            ...loadedPage,
            title: currentPage.title ?? loadedPage.title,
            page_number:
              currentPage.page_number ??
              loadedPage.page_number,
            notebook:
              currentPage.notebook ?? notebookRef.current
          }
        })

        pagesRef.current = nextPages
        return nextPages
      })
    },
    []
  )

  const requestPageBatch = useCallback(
    (
      pageIds: string[]
    ): Promise<NotebookPage[]> => {
      const notebookId = notebookIdRef.current
      const uniquePageIds = [...new Set(pageIds)]
        .filter((pageId) => !pageId.startsWith('temp-'))
        .slice(0, PAGE_WARMUP_BATCH_SIZE)

      if (!notebookId || uniquePageIds.length === 0) {
        return Promise.resolve([])
      }

      const query = new URLSearchParams({
        view: 'content',
        ids: uniquePageIds.join(',')
      })
      const batchPromise = fetch(
        `/api/notebooks/${notebookId}/pages?${query}`
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Failed to load page content: ${response.status}`
            )
          }

          const loadedPages =
            (await response.json()) as NotebookPage[]
          const hydratedPages = loadedPages.map(
            (loadedPage) => ({
              ...loadedPage,
              notebook:
                loadedPage.notebook ?? notebookRef.current
            })
          )

          mergeLoadedPages(hydratedPages)
          return hydratedPages
        })
        .finally(() => {
          uniquePageIds.forEach((pageId) => {
            pageLoadPromisesRef.current.delete(pageId)
          })
        })

      uniquePageIds.forEach((pageId) => {
        pageLoadPromisesRef.current.set(
          pageId,
          batchPromise.then(
            (loadedPages) =>
              loadedPages.find(
                (loadedPage) => loadedPage.id === pageId
              ) ?? null
          )
        )
      })

      return batchPromise
    },
    [mergeLoadedPages]
  )

  const loadPageById = useCallback(
    async (pageId: string) => {
      const cachedPage = pagesRef.current.find(
        (listedPage) =>
          listedPage.id === pageId &&
          listedPage.content !== undefined
      )

      if (cachedPage) return cachedPage

      const existingRequest =
        pageLoadPromisesRef.current.get(pageId)
      if (existingRequest) return existingRequest

      const loadedPages = await requestPageBatch([pageId])
      return (
        loadedPages.find(
          (loadedPage) => loadedPage.id === pageId
        ) ?? null
      )
    },
    [requestPageBatch]
  )

  const warmPageContents = useCallback(
    async (pageIds: string[], generation: number) => {
      for (
        let index = 0;
        index < pageIds.length;
        index += PAGE_WARMUP_BATCH_SIZE
      ) {
        if (warmupGenerationRef.current !== generation) return

        const batch = pageIds
          .slice(index, index + PAGE_WARMUP_BATCH_SIZE)
          .filter((pageId) => {
            const cached = pagesRef.current.find(
              (listedPage) =>
                listedPage.id === pageId &&
                listedPage.content !== undefined
            )

            return (
              !cached &&
              !pageLoadPromisesRef.current.has(pageId)
            )
          })

        if (batch.length > 0) {
          try {
            await requestPageBatch(batch)
          } catch (warmupError) {
            console.error(
              'Failed to warm notebook pages:',
              warmupError
            )
            return
          }
        }

        await new Promise<void>((resolve) => {
          if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(() => resolve(), {
              timeout: 250
            })
          } else {
            setTimeout(resolve, 0)
          }
        })
      }
    },
    [requestPageBatch]
  )

  const ensureAllPagesLoaded = useCallback(async () => {
    const pageIds = pagesRef.current
      .filter(
        (listedPage) =>
          listedPage.content === undefined &&
          !listedPage.isPendingCreation
      )
      .map((listedPage) => listedPage.id)

    try {
      for (
        let index = 0;
        index < pageIds.length;
        index += PAGE_WARMUP_BATCH_SIZE
      ) {
        const batch = pageIds.slice(
          index,
          index + PAGE_WARMUP_BATCH_SIZE
        )
        const existingRequests = batch
          .map((pageId) =>
            pageLoadPromisesRef.current.get(pageId)
          )
          .filter(
            (
              request
            ): request is Promise<NotebookPage | null> =>
              request !== undefined
          )
        const newPageIds = batch.filter(
          (pageId) =>
            !pageLoadPromisesRef.current.has(pageId)
        )

        await Promise.all([
          ...existingRequests,
          ...(newPageIds.length > 0
            ? [requestPageBatch(newPageIds)]
            : [])
        ])
      }

      return pagesRef.current.every(
        (listedPage) => listedPage.content !== undefined
      )
    } catch (loadError) {
      console.error(
        'Failed to finish loading notebook pages:',
        loadError
      )
      return false
    }
  }, [requestPageBatch])

  useEffect(() => {
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current)
      cleanupTimerRef.current = null
    }

    async function loadPage() {
      try {
        const { id } = await params

        if (initializationPageIdRef.current === id) return
        initializationPageIdRef.current = id
        warmupGenerationRef.current += 1
        setPageDirectoryLoaded(false)
        const generation = warmupGenerationRef.current
        const response = await fetch(`/api/pages/${id}`)

        if (!response.ok) {
          throw new Error(
            `Failed to load page: ${response.status}`
          )
        }

        const pageData: NotebookPage = await response.json()
        const notebookId =
          pageData.notebook?.id || pageData.notebook_id

        notebookIdRef.current = notebookId ?? null
        notebookRef.current = pageData.notebook
        lastSavedContentRef.current = JSON.stringify(
          pageData.content ?? null
        )
        pendingContentRef.current = null
        activePageIdRef.current = pageData.id
        pagesRef.current = [pageData]
        setPages([pageData])
        setPage(pageData)
        setSelectedReadPageId(pageData.id)
        setLoading(false)

        if (!notebookId) return

        const openedAt = new Date().toISOString()

        void fetch(`/api/notebooks/${notebookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markOpened: true })
        })
          .then((openResponse) => {
            if (openResponse.ok && pageData.user_id) {
              markNotebookOpenedInSessionCache(
                pageData.user_id,
                notebookId,
                openedAt,
                pageData.id
              )
            }
          })
          .catch((openError) => {
            console.error(
              'Failed to record notebook activity:',
              openError
            )
          })

        try {
          const pagesResponse = await fetch(
            `/api/notebooks/${notebookId}/pages?view=summary`
          )

          if (!pagesResponse.ok) {
            throw new Error(
              `Failed to load page directory: ${pagesResponse.status}`
            )
          }

          const pageDirectory =
            (await pagesResponse.json()) as NotebookPage[]
          const directoryWithCurrentPage = pageDirectory.map(
            (listedPage) =>
              listedPage.id === pageData.id
                ? {
                    ...listedPage,
                    ...pageData
                  }
                : {
                    ...listedPage,
                    notebook: pageData.notebook
                  }
          )

          pagesRef.current = directoryWithCurrentPage
          setPages(directoryWithCurrentPage)
          setPageDirectoryLoaded(true)

          void warmPageContents(
            directoryWithCurrentPage.map(
              (listedPage) => listedPage.id
            ),
            generation
          )
        } catch (pagesError) {
          console.error(
            'Failed to load notebook page directory:',
            pagesError
          )
        }
      } catch (loadError) {
        console.error('Error loading page:', loadError)
        setError('Failed to load page')
        setLoading(false)
      }
    }

    void loadPage()

    return () => {
      cleanupTimerRef.current = setTimeout(() => {
        warmupGenerationRef.current += 1
      }, 0)

      if (contentSaveTimeoutRef.current) {
        clearTimeout(contentSaveTimeoutRef.current)
        contentSaveTimeoutRef.current = null
      }
    }
  }, [params, warmPageContents])

  const runContentSaveWorker = async (pageId: string) => {
    while (pendingContentRef.current !== null) {
      const pendingContent = pendingContentRef.current
      const serializedContent = JSON.stringify(pendingContent)

      if (serializedContent === lastSavedContentRef.current) {
        if (
          pendingContentRef.current !== null &&
          JSON.stringify(pendingContentRef.current) ===
            serializedContent
        ) {
          pendingContentRef.current = null
        }
        continue
      }

      try {
        const response = await runMutationRef.current(
          (expectedRevision) =>
            fetch(`/api/pages/${pageId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: pendingContent,
                expectedRevision
              })
            })
        )

        if (!response.ok) {
          throw new Error(
            `Failed to save page content: ${response.status}`
          )
        }

        const savedPage =
          (await response.json()) as Partial<NotebookPage>
        lastSavedContentRef.current = serializedContent
        const savedPageMetadata = pagesRef.current.find(
          (listedPage) => listedPage.id === pageId
        )

        if (
          savedPageMetadata?.user_id &&
          savedPageMetadata.notebook_id
        ) {
          markNotebookOpenedInSessionCache(
            savedPageMetadata.user_id,
            savedPageMetadata.notebook_id,
            new Date().toISOString(),
            pageId
          )
        }
        const isStillLatest =
          pendingContentRef.current !== null &&
          JSON.stringify(pendingContentRef.current) ===
            serializedContent

        if (isStillLatest) {
          pendingContentRef.current = null
          setPages((currentPages) =>
            currentPages.map((currentPage) =>
              currentPage.id === pageId
                ? {
                    ...currentPage,
                    content: pendingContent,
                    updated_at:
                      savedPage.updated_at ??
                      currentPage.updated_at
                  }
                : currentPage
            )
          )
        }
      } catch (saveError) {
        console.error('Failed to save page content:', saveError)
        return false
      }
    }

    return true
  }

  const saveContentNow = async (pageId: string) => {
    if (contentSaveTimeoutRef.current) {
      clearTimeout(contentSaveTimeoutRef.current)
      contentSaveTimeoutRef.current = null
    }

    if (!contentSaveInFlightRef.current) {
      const task = runContentSaveWorker(pageId)
      contentSaveInFlightRef.current = task
      void task.finally(() => {
        if (contentSaveInFlightRef.current === task) {
          contentSaveInFlightRef.current = null
        }
      })
    }

    return contentSaveInFlightRef.current
  }

  const handleContentUpdate = (content: JSONContent) => {
    if (!page) return

    if (page.isPendingCreation) {
      pendingCreatedPageRef.current = {
        ...(pendingCreatedPageRef.current || page),
        content
      }
      setPage((currentPage) =>
        currentPage?.id === page.id
          ? { ...currentPage, content }
          : currentPage
      )
      setPages((currentPages) =>
        currentPages.map((currentPage) =>
          currentPage.id === page.id
            ? { ...currentPage, content }
            : currentPage
        )
      )
      return
    }

    const serializedContent = JSON.stringify(content)
    if (serializedContent === lastSavedContentRef.current) {
      pendingContentRef.current = null
      return
    }

    pendingContentRef.current = content
    if (contentSaveTimeoutRef.current) {
      clearTimeout(contentSaveTimeoutRef.current)
    }

    const pageId = page.id
    contentSaveTimeoutRef.current = setTimeout(() => {
      void saveContentNow(pageId)
    }, 750)
  }

  useEffect(() => {
    const saveWhenHidden = () => {
      if (
        document.visibilityState === 'hidden' &&
        activePageIdRef.current
      ) {
        void saveContentNow(activePageIdRef.current)
      }
    }
    const warnAboutUnsavedContent = (event: BeforeUnloadEvent) => {
      if (
        pendingContentRef.current === null &&
        contentSaveInFlightRef.current === null
      ) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('visibilitychange', saveWhenHidden)
    window.addEventListener(
      'beforeunload',
      warnAboutUnsavedContent
    )
    return () => {
      document.removeEventListener(
        'visibilitychange',
        saveWhenHidden
      )
      window.removeEventListener(
        'beforeunload',
        warnAboutUnsavedContent
      )
    }
  })

  return {
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
    pageWarmup: {
      complete:
        pageDirectoryLoaded &&
        pages.every(
          (listedPage) => listedPage.content !== undefined
        ),
      loaded: pages.filter(
        (listedPage) => listedPage.content !== undefined
      ).length,
      total: pages.length
    },
    pages,
    pendingContentRef,
    pendingCreatedPageRef,
    saveContentNow,
    selectedReadPageId,
    setError,
    setPage,
    setPages,
    setSelectedReadPageId
  }
}
