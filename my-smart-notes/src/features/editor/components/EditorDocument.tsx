import type { ChangeEvent, FocusEvent, MouseEvent } from 'react'
import type { JSONContent } from '@tiptap/core'

import styles from '@/app/editor/[id]/Editor.module.css'
import { TiptapEditor } from '@/components/TiptapEditor'
import type {
  AiHighlightRequest,
  AiInsertRequest,
  AiSelectionSnapshot,
  EditorReplaceRequest,
  NotebookPage
} from '@/features/editor/model/types'

interface EditorDocumentProps {
  canGoNext: boolean
  canGoPrevious: boolean
  darkPaper: boolean
  hasNextPage: boolean
  highlightRequest: AiHighlightRequest | null
  insertRequest: AiInsertRequest | null
  isTitleFocused: boolean
  page: NotebookPage
  replaceRequest: EditorReplaceRequest | null
  onContentMouseDown: (event: MouseEvent<HTMLDivElement>) => void
  onContentUpdate: (content: JSONContent) => void
  onNextPage: () => void
  onPreviousPage: () => void
  onReplaceResult: (messageId: string, applied: boolean) => void
  onSelectionChange: (
    selection: AiSelectionSnapshot | null
  ) => void
  onTitleBlur: (event: FocusEvent<HTMLInputElement>) => void
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void
  onTitleFocus: (event: FocusEvent<HTMLInputElement>) => void
}

export function EditorDocument({
  canGoNext,
  canGoPrevious,
  darkPaper,
  hasNextPage,
  highlightRequest,
  insertRequest,
  isTitleFocused,
  page,
  replaceRequest,
  onContentMouseDown,
  onContentUpdate,
  onNextPage,
  onPreviousPage,
  onReplaceResult,
  onSelectionChange,
  onTitleBlur,
  onTitleChange,
  onTitleFocus
}: EditorDocumentProps) {
  const editorKey = page.editorKey || page.id

  return (
    <>
      <button
        tabIndex={-1}
        aria-label="Previous page"
        aria-keyshortcuts="Alt+Shift+ArrowLeft"
        className={`${styles.navArrow} ${styles.navArrowLeft} navArrow`}
        data-editor-tour="page-navigation"
        onClick={onPreviousPage}
        disabled={!canGoPrevious}
        style={{ opacity: canGoPrevious ? 1 : 0.3 }}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
      >
        ‹
      </button>

      <div
        className={`${styles.paper} ${
          darkPaper ? styles.darkPaper : ''
        }`}
      >
        <input
          key={editorKey}
          data-editor-tour="page-title"
          value={page.title || ''}
          className={styles.titleInput}
          placeholder="Page Title"
          onChange={onTitleChange}
          onFocus={onTitleFocus}
          onBlur={onTitleBlur}
          style={{
            opacity:
              isTitleFocused &&
              (page.title || '').trim().toLowerCase() ===
                'untitled page'
                ? 0.45
                : 1,
            transition: 'opacity 140ms ease'
          }}
        />

        <div
          className={styles.contentArea}
          data-editor-tour="writing-surface"
          onMouseDown={onContentMouseDown}
        >
          <TiptapEditor
            key={editorKey}
            content={page.content}
            onUpdate={onContentUpdate}
            highlightRequest={highlightRequest}
            insertRequest={insertRequest}
            replaceRequest={replaceRequest}
            onSelectionChange={onSelectionChange}
            onReplaceResult={onReplaceResult}
          />
        </div>
      </div>

      <button
        tabIndex={-1}
        aria-label={hasNextPage ? 'Next page' : 'Create next page'}
        aria-keyshortcuts="Alt+Shift+ArrowRight"
        className={`${styles.navArrow} ${styles.navArrowRight} navArrow`}
        onClick={onNextPage}
        disabled={!canGoNext}
        style={{ opacity: canGoNext ? 1 : 0.3 }}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
      >
        {hasNextPage ? '›' : '+›'}
      </button>
    </>
  )
}
