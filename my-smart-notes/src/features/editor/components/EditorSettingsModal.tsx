import { useRef } from 'react'

import styles from '@/app/editor/[id]/Editor.module.css'
import { LEGAL_DOCUMENT_OPEN_EVENT } from '@/features/legal/constants'
import { McpIntegrationSettings } from '@/features/integrations/components/McpIntegrationSettings'
import { useDialogKeyboard } from '@/lib/accessibility/useDialogKeyboard'

interface EditorSettingsModalProps {
  darkEditorPaper: boolean
  onClose: () => void
  onOpenTutorial: () => void
  onReplayEditorTour: () => void
  onThemeChange: (dark: boolean) => void
}

const COMMANDS = [
  {
    keys: 'Ctrl/Cmd + Z',
    description:
      'Undo text edits. Outside editable fields, restore the most recently deleted page.'
  },
  {
    keys: 'Backspace',
    description:
      'Delete the current or selected page when focus is in the black area outside editable controls.'
  },
  {
    keys: 'Ctrl/Cmd + B',
    description: 'Toggle bold text.'
  },
  {
    keys: 'Ctrl/Cmd + I',
    description: 'Toggle italic text.'
  },
  {
    keys: '``` + Space',
    description:
      'Start a fenced code block. The Code Block button toggles one directly.'
  },
  {
    keys: 'Tab / Shift + Tab',
    description: 'Indent or outdent text and nested list items.'
  },
  {
    keys: 'Ctrl/Cmd + Alt + Shift + M',
    description:
      'Move focus from the writing surface to the editor controls. Use arrow keys to move between controls.'
  },
  {
    keys: 'Escape',
    description:
      'Return focus from the editor controls to the writing surface.'
  }
]

const PAGE_NAVIGATION = [
  {
    keys: 'Alt + Shift + ← / →',
    description:
      'Open the previous or next page without leaving the keyboard.'
  },
  {
    keys: 'Alt + ↑ / ↓',
    description:
      'Move the focused page title earlier or later in Read mode.'
  },
  {
    keys: '‹ Button',
    description: 'Open the previous page.'
  },
  {
    keys: '› / +› Button',
    description:
      'Open the next page, or create one at the end of the notebook.'
  }
]

export function EditorSettingsModal({
  darkEditorPaper,
  onClose,
  onOpenTutorial,
  onReplayEditorTour,
  onThemeChange
}: EditorSettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useDialogKeyboard({
    dialogRef,
    onClose
  })

  return (
    <div
      className={styles.settingsBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className={styles.settingsModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className={styles.settingsModalHeader}>
          <h2 id="settings-modal-title">Settings</h2>

          <button
            className={styles.settingsCloseButton}
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            autoFocus
          >
            ×
          </button>
        </div>

        <div className={styles.settingsModalBody}>
          <section
            className={`${styles.settingsSection} ${styles.settingsTutorialSection}`}
          >
            <div className={styles.settingsTutorialHeading}>
              <h3 className={styles.settingsSectionTitle}>
                Tutorial
              </h3>
              <span className={styles.settingsTutorialBadge}>
                Essential
              </span>
            </div>

            <div className={styles.settingsPreferenceRow}>
              <div>
                <p className={styles.settingsPreferenceName}>
                  Learn every Sentia workflow
                </p>
                <p
                  className={
                    styles.settingsPreferenceDescription
                  }
                >
                  Take the complete guided tour of notebooks,
                  pages, editing, commands, recovery, and
                  account tools.
                </p>
              </div>

              <div className={styles.settingsTutorialActions}>
                <button
                  type="button"
                  className={styles.settingsTutorialButton}
                  onClick={onOpenTutorial}
                >
                  Full Tutorial
                </button>

                <button
                  type="button"
                  className={
                    styles.settingsTutorialSecondaryButton
                  }
                  onClick={onReplayEditorTour}
                >
                  Replay Editor Tour
                </button>
              </div>
            </div>
          </section>

          <section className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>
              Appearance
            </h3>

            <div className={styles.settingsPreferenceRow}>
              <div>
                <p className={styles.settingsPreferenceName}>
                  Application theme
                </p>
                <p
                  className={
                    styles.settingsPreferenceDescription
                  }
                >
                  Use a light or dark theme across Sentia.
                </p>
              </div>

              <div
                className={styles.paperThemeControl}
                role="radiogroup"
                aria-label="Application theme"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!darkEditorPaper}
                  className={`${styles.paperThemeButton} ${
                    !darkEditorPaper
                      ? styles.paperThemeButtonActive
                      : ''
                  }`}
                  onClick={() => onThemeChange(false)}
                >
                  Light
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={darkEditorPaper}
                  className={`${styles.paperThemeButton} ${
                    darkEditorPaper
                      ? styles.paperThemeButtonActive
                      : ''
                  }`}
                  onClick={() => onThemeChange(true)}
                >
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>
              Commands
            </h3>

            <div className={styles.commandList}>
              {COMMANDS.map((command) => (
                <div
                  className={styles.commandRow}
                  key={command.keys}
                >
                  <kbd className={styles.commandKeys}>
                    {command.keys}
                  </kbd>
                  <span className={styles.commandDescription}>
                    {command.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>
              Page Navigation
            </h3>

            <div className={styles.commandList}>
              {PAGE_NAVIGATION.map((command) => (
                <div
                  className={styles.commandRow}
                  key={command.keys}
                >
                  <span className={styles.commandKeys}>
                    {command.keys}
                  </span>
                  <span className={styles.commandDescription}>
                    {command.description}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>
              Reorder Pages
            </h3>

            <div
              className={styles.reorderGuide}
              aria-label="Drag page titles to reorder them in Read mode"
            >
              <div className={styles.reorderGuidePage}>
                <span>••</span>
                <span>Page 1</span>
              </div>

              <div
                className={`${styles.reorderGuidePage} ${styles.reorderGuideActive}`}
              >
                <span>••</span>
                <span>Page 2</span>
                <span className={styles.reorderGuideArrow}>↕</span>
              </div>

              <div className={styles.reorderGuidePage}>
                <span>••</span>
                <span>Page 3</span>
              </div>
            </div>

            <p className={styles.settingsNote}>
              In Read mode, drag a bulleted page title above or
              below another title. The new order saves
              automatically.
            </p>
          </section>

          <section className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>
              Legal &amp; Privacy
            </h3>

            <p className={styles.settingsNote}>
              Revisit Sentia&apos;s Privacy Policy and Terms of
              Service at any time.
            </p>

            <button
              type="button"
              className={styles.settingsTutorialSecondaryButton}
              onClick={() => {
                onClose()
                window.dispatchEvent(
                  new Event(LEGAL_DOCUMENT_OPEN_EVENT)
                )
              }}
            >
              View Privacy &amp; Terms
            </button>
          </section>

          <McpIntegrationSettings className={styles.settingsSection} />

          <section className={styles.settingsSection}>
            <h3 className={styles.settingsSectionTitle}>Saving</h3>

            <p className={styles.settingsNote}>
              Page content and notebook names save automatically
              after a short pause in typing.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
