'use client'

import { useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/core'

import type {
  EditorReplaceRequest,
  NotebookPage
} from '@/features/editor/model/types'
import { readImportedFile } from '@/features/file-transfer/lib/fileImport'
import { exportPagesToPdf } from '@/features/file-transfer/lib/pdfExport'
import {
  exportPagesToMarkdown,
  exportPagesToPlainText,
  type ExportFormat
} from '@/features/file-transfer/lib/textExport'

interface UseEditorFileTransferOptions {
  page: NotebookPage | null
  pendingContentRef: React.MutableRefObject<JSONContent | null>
  saveContentNow: (pageId: string) => Promise<boolean>
  setPage: React.Dispatch<
    React.SetStateAction<NotebookPage | null>
  >
  setPages: React.Dispatch<
    React.SetStateAction<NotebookPage[]>
  >
}

interface PendingImport {
  content: JSONContent
  pageId: string
  requestId: string
}

export function useEditorFileTransfer({
  page,
  pendingContentRef,
  saveContentNow,
  setPage,
  setPages
}: UseEditorFileTransferOptions) {
  const [isTransferringFile, setIsTransferringFile] =
    useState(false)
  const [importReplaceRequest, setImportReplaceRequest] =
    useState<EditorReplaceRequest | null>(null)
  const pendingImportRef = useRef<PendingImport | null>(null)

  const exportPages = async (
    format: ExportFormat,
    notebookName: string,
    pagesToExport: NotebookPage[],
    fileName: string
  ) => {
    if (format === 'pdf') {
      await exportPagesToPdf(
        notebookName,
        pagesToExport,
        fileName
      )
      return
    }

    if (format === 'markdown') {
      exportPagesToMarkdown(
        notebookName,
        pagesToExport,
        fileName
      )
      return
    }

    exportPagesToPlainText(
      notebookName,
      pagesToExport,
      fileName
    )
  }

  const showTransferError = (error: unknown, fallback: string) => {
    console.error(fallback, error)
    window.alert(error instanceof Error ? error.message : fallback)
  }

  const importIntoCurrentPage = async (file: File) => {
    if (!page || isTransferringFile) return

    if (page.isPendingCreation) {
      window.alert(
        'Please wait for this page to finish creating before importing.'
      )
      return
    }

    const approved = window.confirm(
      `Replace the current page with the contents of "${file.name}"?`
    )

    if (!approved) return

    setIsTransferringFile(true)

    try {
      const imported = await readImportedFile(file)
      const requestId = crypto.randomUUID()
      const sourceMessageId = `import:${requestId}`

      pendingImportRef.current = {
        content: imported.content,
        pageId: page.id,
        requestId: sourceMessageId
      }
      setImportReplaceRequest({
        id: requestId,
        sourceMessageId,
        target: 'page',
        content: imported.content
      })
    } catch (error) {
      setIsTransferringFile(false)
      showTransferError(error, 'Failed to import the selected file.')
    }
  }

  const finishImportReplacement = (
    sourceMessageId: string,
    applied: boolean
  ) => {
    const pendingImport = pendingImportRef.current

    if (
      !pendingImport ||
      pendingImport.requestId !== sourceMessageId
    ) {
      return false
    }

    pendingImportRef.current = null
    setImportReplaceRequest(null)

    if (!applied) {
      setIsTransferringFile(false)
      window.alert('The selected file could not replace this page.')
      return true
    }

    setPage((currentPage) =>
      currentPage?.id === pendingImport.pageId
        ? {
            ...currentPage,
            content: pendingImport.content
          }
        : currentPage
    )
    setPages((currentPages) =>
      currentPages.map((currentPage) =>
        currentPage.id === pendingImport.pageId
          ? {
              ...currentPage,
              content: pendingImport.content
            }
          : currentPage
      )
    )

    void saveContentNow(pendingImport.pageId)
      .then((saved) => {
        if (!saved) {
          throw new Error(
            'The file was inserted, but it could not be saved.'
          )
        }
      })
      .catch((error) => {
        showTransferError(
          error,
          'The imported page could not be fully saved.'
        )
      })
      .finally(() => setIsTransferringFile(false))

    return true
  }

  const exportCurrentPage = async (format: ExportFormat) => {
    if (!page || isTransferringFile) return

    setIsTransferringFile(true)

    try {
      const pendingContent = pendingContentRef.current
      const saved = await saveContentNow(page.id)

      if (!saved) {
        throw new Error(
          'Save the current page successfully before exporting it.'
        )
      }

      const notebookName = page.notebook?.name || 'My Notebook'
      const exportPage = {
        ...page,
        content: pendingContent ?? page.content
      }

      await exportPages(
        format,
        notebookName,
        [exportPage],
        exportPage.title || 'Untitled Page'
      )
    } catch (error) {
      showTransferError(error, 'Failed to export this page.')
    } finally {
      setIsTransferringFile(false)
    }
  }

  const exportCurrentNotebook = async (
    format: ExportFormat
  ) => {
    if (!page || isTransferringFile) return

    const notebookId = page.notebook?.id || page.notebook_id

    if (!notebookId) {
      window.alert('Notebook ID is missing.')
      return
    }

    setIsTransferringFile(true)

    try {
      const saved = await saveContentNow(page.id)

      if (!saved) {
        throw new Error(
          'Save the current page successfully before exporting the notebook.'
        )
      }

      const response = await fetch(
        `/api/notebooks/${notebookId}/pages`
      )

      if (!response.ok) {
        throw new Error('Failed to load the notebook for export.')
      }

      const notebookPages = (await response.json()) as NotebookPage[]
      const notebookName = page.notebook?.name || 'My Notebook'

      await exportPages(
        format,
        notebookName,
        notebookPages,
        notebookName
      )
    } catch (error) {
      showTransferError(error, 'Failed to export this notebook.')
    } finally {
      setIsTransferringFile(false)
    }
  }

  return {
    exportCurrentNotebook,
    exportCurrentPage,
    finishImportReplacement,
    importIntoCurrentPage,
    importReplaceRequest,
    isTransferringFile
  }
}
