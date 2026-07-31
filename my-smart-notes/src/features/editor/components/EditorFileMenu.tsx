import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject
} from 'react'

import styles from '@/app/editor/[id]/Editor.module.css'
import { IMPORT_FILE_ACCEPT } from '@/features/file-transfer/lib/content'
import type { ExportFormat } from '@/features/file-transfer/lib/textExport'
import type { LocalMirrorStatus } from '@/features/local-mirror/hooks/useLocalMarkdownMirror'

interface EditorFileMenuProps {
  containerRef: RefObject<HTMLDivElement | null>
  isDeletingNotebook: boolean
  isLocalMirrorConnected: boolean
  isTransferringFile: boolean
  isOpen: boolean
  localMirrorDirectoryName: string | null
  localMirrorError: string | null
  localMirrorStatus: LocalMirrorStatus
  onConnectLocalFolder: () => void
  onDeleteNotebook: () => void
  onDisconnectLocalFolder: () => void
  onExportNotebook: (format: ExportFormat) => void
  onExportPage: (format: ExportFormat) => void
  onGoHome: () => void
  onImportFile: (file: File) => void
  onOpenSettings: () => void
  onOpenStudyQuiz: () => void
  onRenameNotebook: () => void
  onToggle: () => void
}

export function EditorFileMenu({
  containerRef,
  isDeletingNotebook,
  isLocalMirrorConnected,
  isTransferringFile,
  isOpen,
  localMirrorDirectoryName,
  localMirrorError,
  localMirrorStatus,
  onConnectLocalFolder,
  onDeleteNotebook,
  onDisconnectLocalFolder,
  onExportNotebook,
  onExportPage,
  onGoHome,
  onImportFile,
  onOpenSettings,
  onOpenStudyQuiz,
  onRenameNotebook,
  onToggle
}: EditorFileMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileButtonRef = useRef<HTMLButtonElement>(null)
  const [exportTarget, setExportTarget] = useState<
    'notebook' | 'page' | null
  >(null)
  const localMirrorStatusLabel = {
    connecting: 'Connecting…',
    disconnected: 'Not connected',
    error: 'Sync failed',
    'permission-required': 'Permission required',
    synced: 'Synced',
    syncing: 'Syncing…',
    unsupported: 'Unavailable in this browser'
  }[localMirrorStatus]

  useEffect(() => {
    if (!isOpen) setExportTarget(null)
  }, [isOpen])

  const selectExportFormat = (format: ExportFormat) => {
    if (exportTarget === 'page') {
      onExportPage(format)
    } else if (exportTarget === 'notebook') {
      onExportNotebook(format)
    }

    setExportTarget(null)
  }

  const focusFirstMenuItem = () => {
    window.requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus()
    })
  }

  const handleMenuKeyDown = (
    event: KeyboardEvent<HTMLDivElement>
  ) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled])'
      )
    ).filter((item) => item.offsetParent !== null)
    const currentIndex = items.indexOf(
      event.target as HTMLElement
    )

    if (event.key === 'Escape') {
      event.preventDefault()
      onToggle()
      fileButtonRef.current?.focus()
      return
    }

    if (
      currentIndex === -1 ||
      !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
        event.key
      )
    ) {
      return
    }

    event.preventDefault()

    if (event.key === 'Home') {
      items[0]?.focus()
    } else if (event.key === 'End') {
      items[items.length - 1]?.focus()
    } else {
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex =
        (currentIndex + direction + items.length) %
        items.length
      items[nextIndex]?.focus()
    }
  }

  return (
    <div
      className={styles.fileOptionsSection}
      ref={containerRef}
      data-editor-tour="editor-utilities"
    >
      <div className={styles.fileMenuContainer}>
        <button
          ref={fileButtonRef}
          tabIndex={-1}
          data-editor-keyboard-start="true"
          className={`${styles.fileOption} ${styles.sidebarUtilityButton}`}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="menu"
          onClick={onToggle}
          onKeyDown={(event) => {
            if (
              !isOpen &&
              event.key === 'ArrowRight'
            ) {
              event.preventDefault()
              onToggle()
              focusFirstMenuItem()
            }
          }}
        >
          FILE
        </button>

        {isOpen && (
          <div
            className={styles.fileMenu}
            role="menu"
            onKeyDown={handleMenuKeyDown}
          >
            <input
              ref={fileInputRef}
              className={styles.visuallyHiddenFileInput}
              type="file"
              accept={IMPORT_FILE_ACCEPT}
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) onImportFile(file)
              }}
            />

            {exportTarget ? (
              <>
                <div className={styles.exportFormatHeading}>
                  Export {exportTarget}
                </div>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={() => selectExportFormat('pdf')}
                >
                  PDF Document (.pdf)
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={() => selectExportFormat('markdown')}
                >
                  Markdown (.md)
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={() => selectExportFormat('text')}
                >
                  Plain Text (.txt)
                </button>

                <button
                  className={`${styles.fileMenuOption} ${styles.exportBackOption}`}
                  type="button"
                  role="menuitem"
                  onClick={() => setExportTarget(null)}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={onRenameNotebook}
                >
                  Rename Notebook
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  disabled={isTransferringFile}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import into Page
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  disabled={isTransferringFile}
                  onClick={() => setExportTarget('page')}
                >
                  Export Page
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  disabled={isTransferringFile}
                  onClick={() => setExportTarget('notebook')}
                >
                  Export Notebook
                </button>

                <div
                  className={styles.localMirrorStatus}
                  title={localMirrorError ?? localMirrorDirectoryName ?? ''}
                >
                  <span>Local Markdown</span>
                  <span>{localMirrorStatusLabel}</span>
                </div>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  disabled={
                    localMirrorStatus === 'connecting' ||
                    localMirrorStatus === 'syncing' ||
                    localMirrorStatus === 'unsupported'
                  }
                  onClick={onConnectLocalFolder}
                >
                  {isLocalMirrorConnected
                    ? localMirrorStatus === 'permission-required'
                      ? 'Reconnect Local Folder'
                      : 'Sync Local Folder'
                    : 'Connect Local Folder'}
                </button>

                {isLocalMirrorConnected && (
                  <button
                    className={styles.fileMenuOption}
                    type="button"
                    role="menuitem"
                    onClick={onDisconnectLocalFolder}
                  >
                    Disconnect Local Folder
                  </button>
                )}

                <button
                  className={`${styles.fileMenuOption} ${styles.dangerFileMenuOption}`}
                  type="button"
                  role="menuitem"
                  disabled={isDeletingNotebook}
                  onClick={onDeleteNotebook}
                >
                  Delete Notebook
                </button>

                <button
                  className={styles.fileMenuOption}
                  type="button"
                  role="menuitem"
                  onClick={onOpenStudyQuiz}
                >
                  Study Quiz
                </button>

              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.fileGrid}>
        <button
          tabIndex={-1}
          className={`${styles.fileOption} ${styles.sidebarUtilityButton}`}
          type="button"
          onClick={onOpenSettings}
        >
          SETTINGS
        </button>
        <button
          tabIndex={-1}
          className={`${styles.fileOption} ${styles.sidebarUtilityButton}`}
          type="button"
          onClick={onGoHome}
        >
          HOME
        </button>
      </div>
    </div>
  )
}
