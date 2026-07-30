import type {
  ChangeEvent,
  DragEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject
} from 'react'

import styles from '@/app/editor/[id]/Editor.module.css'
import type { NotebookPage } from '../model/types'

interface EditorSidebarProps {
  alignment: string
  dragOverPageId: string | null
  dragOverPosition: 'before' | 'after' | null
  draggedPageId: string | null
  fileMenu: ReactNode
  fontFamily: string
  fontSizeInput: string
  isBold: boolean
  isBulletList: boolean
  isCodeBlock: boolean
  isItalic: boolean
  isOrderedList: boolean
  isStrikethrough: boolean
  isMobileOpen: boolean
  mode: 'read' | 'write'
  notebookNameInputRef: RefObject<HTMLInputElement | null>
  page: NotebookPage
  pageWarmup: {
    loaded: number
    total: number
  }
  pages: NotebookPage[]
  selectedReadPageId: string | null
  textColor: string
  onAlignmentClick: (
    alignment: 'left' | 'center' | 'right' | 'justify',
    event: MouseEvent<HTMLButtonElement>
  ) => void
  onBoldClick: (event: MouseEvent<HTMLButtonElement>) => void
  onColorChange: (event: ChangeEvent<HTMLInputElement>) => void
  onCodeBlockClick: (event: MouseEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
  onFontSizeBlur: () => void
  onFontSizeChange: (event: ChangeEvent<HTMLInputElement>) => void
  onFontSizeFocus: (event: FocusEvent<HTMLInputElement>) => void
  onItalicClick: (event: MouseEvent<HTMLButtonElement>) => void
  onListClick: (
    list: 'bullets' | 'numbers',
    event: MouseEvent<HTMLButtonElement>
  ) => void
  onModeChange: (mode: 'read' | 'write') => void
  onMobileClose: () => void
  onNotebookNameBlur: (event: FocusEvent<HTMLInputElement>) => void
  onNotebookNameChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPageClick: (pageId: string) => void
  onPageDragOver: (
    event: DragEvent<HTMLButtonElement>,
    pageId: string
  ) => void
  onPageDragStart: (
    event: DragEvent<HTMLButtonElement>,
    pageId: string
  ) => void
  onPageDrop: (
    event: DragEvent<HTMLButtonElement>,
    pageId: string
  ) => void
  onPageKeyboardReorder: (
    pageId: string,
    direction: 'up' | 'down'
  ) => void
  onStrikeClick: (event: MouseEvent<HTMLButtonElement>) => void
  keyboardReorderStatus: string
}

const ALIGNMENTS = [
  'left',
  'center',
  'right',
  'justify'
] as const

export function EditorSidebar({
  alignment,
  dragOverPageId,
  dragOverPosition,
  draggedPageId,
  fileMenu,
  fontFamily,
  fontSizeInput,
  isBold,
  isBulletList,
  isCodeBlock,
  isItalic,
  isOrderedList,
  isStrikethrough,
  isMobileOpen,
  mode,
  notebookNameInputRef,
  page,
  pageWarmup,
  pages,
  selectedReadPageId,
  textColor,
  onAlignmentClick,
  onBoldClick,
  onColorChange,
  onCodeBlockClick,
  onDragEnd,
  onFontSizeBlur,
  onFontSizeChange,
  onFontSizeFocus,
  onItalicClick,
  onListClick,
  onModeChange,
  onMobileClose,
  onNotebookNameBlur,
  onNotebookNameChange,
  onPageClick,
  onPageDragOver,
  onPageDragStart,
  onPageDrop,
  onPageKeyboardReorder,
  keyboardReorderStatus,
  onStrikeClick
}: EditorSidebarProps) {
  const handleSidebarKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement

    if (target.closest('[role="menu"]')) return

    if (event.key === 'Escape') {
      onMobileClose()
      const writingSurface =
        document.querySelector<HTMLElement>(
          '.ProseMirror[contenteditable="true"]'
        )

      if (writingSurface) {
        event.preventDefault()
        writingSurface.focus()
      }
      return
    }

    if (
      event.altKey ||
      target.matches('input, select, textarea') ||
      !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
        event.key
      )
    ) {
      return
    }

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled])'
      )
    ).filter((control) => control.offsetParent !== null)
    const currentIndex = controls.indexOf(target)
    if (currentIndex === -1 || controls.length === 0) return

    event.preventDefault()

    if (event.key === 'Home') {
      controls[0].focus()
    } else if (event.key === 'End') {
      controls[controls.length - 1].focus()
    } else {
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex =
        (currentIndex + direction + controls.length) %
        controls.length
      controls[nextIndex].focus()
    }
  }

  return (
    <div
      id="editor-sidebar"
      className={`${styles.sidebar} ${
        isMobileOpen ? styles.sidebarMobileOpen : ''
      }`}
      onKeyDownCapture={handleSidebarKeyDown}
    >
      <div className={styles.mobileSidebarHeader}>
        <span>Editor tools</span>
        <button
          type="button"
          aria-label="Close editor tools"
          onClick={onMobileClose}
        >
          ×
        </button>
      </div>

      <div className={styles.notebookNameSection}>
        <label className={styles.sidebarLabel}>Notebook</label>
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
          onChange={onNotebookNameChange}
          onBlur={onNotebookNameBlur}
        />
      </div>

      <div
        className={styles.modeSection}
        data-editor-tour="mode-controls"
      >
        <label className={styles.modeLabel}>Mode</label>
        <div className={styles.modeButtons}>
          {(['read', 'write'] as const).map((nextMode) => (
            <button
              key={nextMode}
              className={`${styles.modeButton} ${
                mode === nextMode ? styles.activeModeButton : ''
              }`}
              type="button"
              onClick={() => onModeChange(nextMode)}
            >
              {nextMode === 'read' ? 'Read' : 'Write'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'write' ? (
        <div
          className={styles.sidebarContent}
          data-editor-tour="writing-tools"
        >
          <section className={styles.sidebarSection}>
            <label className={styles.sidebarLabel}>
              Formatting
            </label>
            <div className={styles.formattingGrid}>
              <button
                tabIndex={-1}
                className={`${styles.formattingOption} ${
                  isBold ? styles.activeFormatting : ''
                }`}
                type="button"
                onClick={onBoldClick}
                onMouseDown={(event) => event.preventDefault()}
              >
                <strong>B</strong>
              </button>
              <button
                tabIndex={-1}
                className={`${styles.formattingOption} ${
                  isItalic ? styles.activeFormatting : ''
                }`}
                type="button"
                onClick={onItalicClick}
                onMouseDown={(event) => event.preventDefault()}
              >
                <em>I</em>
              </button>
              <button
                tabIndex={-1}
                className={`${styles.formattingOption} ${
                  isStrikethrough ? styles.activeFormatting : ''
                }`}
                type="button"
                onClick={onStrikeClick}
                onMouseDown={(event) => event.preventDefault()}
              >
                <s>S</s>
              </button>
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <label className={styles.sidebarLabel}>Font</label>
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
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Courier New">Courier New</option>
            </select>
          </section>

          <section className={styles.sidebarSection}>
            <label className={styles.sidebarLabel}>Size</label>
            <div className={styles.sizeInputContainer}>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Font size in pixels"
                value={fontSizeInput}
                onChange={onFontSizeChange}
                onBlur={onFontSizeBlur}
                onFocus={onFontSizeFocus}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
                className={styles.sizeInput}
                maxLength={2}
              />
              <span className={styles.sizeUnit}>px</span>
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <label className={styles.sidebarLabel}>Color</label>
            <div className={styles.colorPicker}>
              <div
                className={styles.colorPreviewContainer}
                onClick={() =>
                  document.getElementById('colorInput')?.click()
                }
              >
                <div
                  className={styles.colorPreview}
                  style={{ backgroundColor: textColor }}
                />
                <span className={styles.colorHex}>
                  {textColor}
                </span>
              </div>
              <input
                id="colorInput"
                type="color"
                value={textColor}
                className={styles.colorInput}
                onChange={onColorChange}
              />
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <label className={styles.sidebarLabel}>Alignment</label>
            <div className={styles.alignmentGrid}>
              {ALIGNMENTS.map((value) => (
                <button
                  key={value}
                  tabIndex={-1}
                  className={`${styles.alignmentOption} ${
                    alignment === value
                      ? styles.activeFormatting
                      : ''
                  }`}
                  type="button"
                  onClick={(event) =>
                    onAlignmentClick(value, event)
                  }
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {value[0].toUpperCase() + value.slice(1)}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <label className={styles.sidebarLabel}>Lists</label>
            <div className={styles.listGrid}>
              <button
                tabIndex={-1}
                className={`${styles.listOption} ${
                  isBulletList ? styles.activeList : ''
                }`}
                type="button"
                onClick={(event) => onListClick('bullets', event)}
                onMouseDown={(event) => event.preventDefault()}
              >
                • Bullets
              </button>
              <button
                tabIndex={-1}
                className={`${styles.listOption} ${
                  isOrderedList ? styles.activeList : ''
                }`}
                type="button"
                onClick={(event) => onListClick('numbers', event)}
                onMouseDown={(event) => event.preventDefault()}
              >
                1. Numbers
              </button>
            </div>
          </section>

          <section
            className={styles.sidebarSection}
          >
            <label className={styles.sidebarLabel}>Insert</label>
            <div className={styles.insertGrid}>
              <button
                tabIndex={-1}
                className={`${styles.insertOption} ${
                  isCodeBlock ? styles.activeFormatting : ''
                }`}
                type="button"
                aria-pressed={isCodeBlock}
                title="Toggle code block (Ctrl/Cmd + Alt + 0)"
                onClick={onCodeBlockClick}
                onMouseDown={(event) => event.preventDefault()}
              >
                Code Block
              </button>
              {['Image', 'Draw Box', 'Table'].map((label) => (
                <button
                  key={label}
                  tabIndex={-1}
                  className={styles.insertOption}
                  type="button"
                  disabled
                  title="Coming soon"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className={styles.sidebarContent}>
          <div
            className={styles.pagesList}
            data-editor-tour="page-list"
          >
            <div className={styles.pagesLabelRow}>
              <label className={styles.sidebarLabel}>Pages</label>
              {pageWarmup.total > pageWarmup.loaded && (
                <span
                  className={styles.pageWarmupStatus}
                  role="status"
                >
                  Loading {pageWarmup.loaded}/{pageWarmup.total}
                </span>
              )}
            </div>
            <div className={styles.pagesScroll}>
              {pages.map((listedPage) => (
                <button
                  key={listedPage.id}
                  className={`${styles.pageItem} ${
                    selectedReadPageId === listedPage.id
                      ? styles.activePageItem
                      : ''
                  } ${
                    draggedPageId === listedPage.id
                      ? styles.draggingPageItem
                      : ''
                  } ${
                    dragOverPageId === listedPage.id &&
                    dragOverPosition === 'before'
                      ? styles.dragOverBefore
                      : ''
                  } ${
                    dragOverPageId === listedPage.id &&
                    dragOverPosition === 'after'
                      ? styles.dragOverAfter
                      : ''
                  }`}
                  type="button"
                  draggable
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  onClick={() => onPageClick(listedPage.id)}
                  onKeyDown={(event) => {
                    if (
                      !event.altKey ||
                      !['ArrowUp', 'ArrowDown'].includes(event.key)
                    ) {
                      return
                    }

                    event.preventDefault()
                    event.stopPropagation()
                    onPageKeyboardReorder(
                      listedPage.id,
                      event.key === 'ArrowUp' ? 'up' : 'down'
                    )
                  }}
                  onDragStart={(event) =>
                    onPageDragStart(event, listedPage.id)
                  }
                  onDragOver={(event) =>
                    onPageDragOver(event, listedPage.id)
                  }
                  onDrop={(event) =>
                    onPageDrop(event, listedPage.id)
                  }
                  onDragEnd={onDragEnd}
                >
                  <span>•</span>
                  {listedPage.title || 'Untitled Page'}
                </button>
              ))}
            </div>
            <span className="sr-only" role="status" aria-live="polite">
              {keyboardReorderStatus}
            </span>
          </div>
        </div>
      )}

      {fileMenu}
    </div>
  )
}
