'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './TutorialModal.module.css'

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
}

interface TutorialItem {
  title: string
  description: string
  keys?: string
}

interface TutorialStep {
  label: string
  title: string
  summary: string
  items: TutorialItem[]
  tip: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    label: 'Start',
    title: 'The Sentia workflow',
    summary:
      'Sentia is organized around notebooks, pages, and a focused writing surface. This tour covers the complete workflow from creating a notebook to recovering deleted pages.',
    items: [
      {
        title: 'Dashboard',
        description:
          'Create, find, rename, open, and delete notebooks from one place.'
      },
      {
        title: 'Editor',
        description:
          'Write and format pages in Write mode, then navigate and reorder them in Read mode.'
      },
      {
        title: 'Automatic saving',
        description:
          'Notebook names, page titles, page content, and page order save automatically.'
      }
    ],
    tip: 'You can reopen this full tutorial at any time from Settings on either the dashboard or editor.'
  },
  {
    label: 'Dashboard',
    title: 'Find and organize notebooks',
    summary:
      'The dashboard is your notebook library. Its controls are designed to keep common actions visible and secondary actions out of the way.',
    items: [
      {
        title: 'Create a notebook',
        description:
          'Select + Create Notebook. Sentia creates the notebook and its first page, then opens the editor.'
      },
      {
        title: 'Search notebooks',
        description:
          'Type part of a notebook name in the centered search field. Clear the field to restore the full library.'
      },
      {
        title: 'Grid and list views',
        description:
          'Use the view control to alternate between notebook cards and a vertical list. Your choice is remembered.'
      },
      {
        title: 'Open a notebook',
        description:
          'Select its card or row. The most recently updated page opens when one is available.'
      }
    ],
    tip: 'The date under a notebook shows today\'s opening time, or the full opened date for older activity.'
  },
  {
    label: 'Notebook menu',
    title: 'Rename, delete, or open separately',
    summary:
      'Each notebook has a three-dot menu for actions that do not need to occupy the main card.',
    items: [
      {
        title: 'Rename',
        description:
          'Choose Rename, enter the new name, and save. Names are limited to 100 characters.'
      },
      {
        title: 'Delete',
        description:
          'Choose Delete and confirm the warning. Notebook deletion also removes all of its pages.'
      },
      {
        title: 'Open in new tab',
        description:
          'Open the notebook without replacing the dashboard tab.'
      },
      {
        title: 'Default notebook name',
        description:
          'Change the starting name for future notebooks in Dashboard Settings under New Notebooks.'
      }
    ],
    tip: 'Notebook deletion is permanent, so Sentia always asks for confirmation first.'
  },
  {
    label: 'Editor basics',
    title: 'Name, write, read, and save',
    summary:
      'The editor sidebar controls the notebook and the paper is the page currently in focus.',
    items: [
      {
        title: 'Name the notebook',
        description:
          'Select the notebook-name field at the top of the sidebar. The default placeholder clears for immediate typing.'
      },
      {
        title: 'Name the page',
        description:
          'Select Page Title at the top of the paper and type a descriptive title.'
      },
      {
        title: 'Write mode',
        description:
          'Use Write to expose text formatting controls and edit the current page.'
      },
      {
        title: 'Read mode',
        description:
          'Use Read for a simpler page list, quick page selection, and drag-and-drop reordering.'
      }
    ],
    tip: 'Pause briefly after typing. Page content, page titles, and the notebook name share the automatic-save delay.'
  },
  {
    label: 'Pages',
    title: 'Create, navigate, reorder, and remove pages',
    summary:
      'Pages form an ordered stack inside each notebook. Navigation controls stay at the paper edge while the sidebar gives direct access.',
    items: [
      {
        title: 'Previous page',
        description:
          'Select the left arrow or use Alt + Shift + Left Arrow to move to the previous page. It disables at the beginning of the notebook.',
        keys: 'Alt + Shift + ←'
      },
      {
        title: 'Next or new page',
        description:
          'Select the right arrow or use Alt + Shift + Right Arrow for the next page. At the end, the command creates a new page immediately.',
        keys: 'Alt + Shift + →'
      },
      {
        title: 'Direct page selection',
        description:
          'In Read mode, select any bulleted page title to open it.'
      },
      {
        title: 'Reorder pages',
        description:
          'In Read mode, drag a page title or focus it and use Alt + Up or Down Arrow. The new order saves automatically.',
        keys: 'Alt + ↑ / ↓'
      },
      {
        title: 'Delete a page',
        description:
          'Focus the dark area outside editable controls, then press Backspace. The page enters the recovery stack until you leave the editor.',
        keys: 'Backspace'
      }
    ],
    tip: 'New pages accept typing immediately. Sentia preserves the caret while the page finishes creating in the background.'
  },
  {
    label: 'Formatting',
    title: 'Format text without losing your place',
    summary:
      'Formatting controls operate on the current selection or typing position and return focus to the editor.',
    items: [
      {
        title: 'Text emphasis',
        description:
          'Use B, I, U, and S for bold, italic, underline, and strikethrough.',
        keys: 'Ctrl/Cmd + B or I'
      },
      {
        title: 'Color',
        description:
          'Choose a text color from the Color section. The active color is reflected in the control.'
      },
      {
        title: 'Alignment',
        description:
          'Apply left, center, right, or justified alignment to the current text block.'
      },
      {
        title: 'Font size',
        description:
          'Enter a size in the font-size field. Moving the caret into differently sized text updates the field to match.'
      },
      {
        title: 'Writing font',
        description:
          'Pages use Roboto Condensed as their clean default writing font.'
      },
      {
        title: 'Code blocks',
        description:
          'Select Code Block or type three backticks followed by Space at the start of a line for an IDE-style fenced block.',
        keys: '``` + Space'
      }
    ],
    tip: 'The softer active-button color indicates which formatting is active at the current caret position.'
  },
  {
    label: 'Lists & tabs',
    title: 'Build lists and structured indentation',
    summary:
      'Lists can start from toolbar buttons or familiar typing shortcuts, and Tab behaves inside the writing surface instead of leaving it.',
    items: [
      {
        title: 'Bullet list',
        description:
          'Select Bullets to begin or end a bulleted list.'
      },
      {
        title: 'Numbered list',
        description:
          'Select Numbers, or type 1. followed by Space at the start of a line.'
      },
      {
        title: 'Roman-numeral list',
        description:
          'Type i. or ii. followed by Space at the start of a line to begin a Roman-numeral list.'
      },
      {
        title: 'Indent and outdent',
        description:
          'Tab inserts an eight-space-width indentation or nests a list item. Shift + Tab removes one indentation level.',
        keys: 'Tab / Shift + Tab'
      },
      {
        title: 'Continue or finish a list',
        description:
          'Enter creates the next item. Press Enter on an empty list item to exit the list.'
      },
      {
        title: 'Move to editor controls',
        description:
          'Use the Google Docs-style focus command to leave the writing surface. Arrow keys move between controls, and Escape returns to the page.',
        keys: 'Ctrl/Cmd + Alt + Shift + M'
      }
    ],
    tip: 'Tab remains dedicated to indentation. Ctrl/Cmd + Alt + Shift + M moves focus to the editor controls, and Escape returns to writing.'
  },
  {
    label: 'Undo & recovery',
    title: 'Undo edits and recover deleted pages',
    summary:
      'Text editing and page deletion share the familiar undo shortcut, with behavior determined by where focus is located.',
    items: [
      {
        title: 'Undo text',
        description:
          'While the caret is in the writing surface, undo the most recent text or formatting edit.',
        keys: 'Ctrl/Cmd + Z'
      },
      {
        title: 'Restore a page',
        description:
          'With focus outside editable fields, Ctrl/Cmd + Z restores the most recently deleted page.',
        keys: 'Ctrl/Cmd + Z'
      },
      {
        title: 'Recover several pages',
        description:
          'Deleted pages form a stack. Repeat undo to restore them newest-first in LIFO order.'
      },
      {
        title: 'Deletion sync',
        description:
          'Pending page deletions are committed when you leave or close the editor, giving you the editing session to undo them.'
      }
    ],
    tip: 'If undo changes text instead of restoring a page, click the dark non-editable area first and try again.'
  },
  {
    label: 'File & settings',
    title: 'Notebook-level controls and appearance',
    summary:
      'FILE contains notebook actions. SETTINGS contains reference material and visual preferences.',
    items: [
      {
        title: 'Rename Notebook',
        description:
          'Open FILE and choose Rename Notebook to focus the notebook-name field.'
      },
      {
        title: 'Delete Notebook',
        description:
          'Open FILE, choose Delete Notebook, and confirm the destructive action.'
      },
      {
        title: 'Local Markdown folder',
        description:
          'Choose Connect Local Folder to maintain a one-way Markdown mirror after cloud saves. Sentia manages only files recorded in its .sentia.json manifest; disconnecting leaves those files on your device.'
      },
      {
        title: 'Home',
        description:
          'Open FILE and choose Home to flush pending work and return to the dashboard.'
      },
      {
        title: 'Light and dark paper',
        description:
          'Choose the editor writing-surface theme from either Settings modal. The preference is shared and remembered.'
      },
      {
        title: 'Command sheet',
        description:
          'Editor Settings retains a compact command and navigation reference for quick reminders.'
      }
    ],
    tip: 'FILE and SETTINGS are notebook utilities; the formatting controls above them affect page content.'
  },
  {
    label: 'Support & account',
    title: 'Feedback, account access, and next steps',
    summary:
      'Sentia includes a feedback loop so problems and ideas can be submitted with optional diagnostic context.',
    items: [
      {
        title: 'Submit feedback',
        description:
          'Open Feedback from the profile menu or Dashboard Settings. Choose a category, write at least 10 characters, and optionally add a rating.'
      },
      {
        title: 'Technical context',
        description:
          'The optional checkbox attaches the current page path and browser user agent to help reproduce an issue.'
      },
      {
        title: 'Contact permission',
        description:
          'Allow contact only when you are comfortable having your account email associated with the submission.'
      },
      {
        title: 'Track submissions',
        description:
          'The feedback screen shows recent submissions and their current status.'
      },
      {
        title: 'Sign out',
        description:
          'Open the dashboard profile menu and choose Sign Out, or use the Account section in Dashboard Settings.'
      }
    ],
    tip: 'You are ready. Create a notebook, write a page, switch to Read mode, and return here whenever you need the full reference.'
  }
]

export function TutorialModal({
  isOpen,
  onClose
}: TutorialModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    setStepIndex(0)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      } else if (event.key === 'ArrowRight') {
        setStepIndex((current) =>
          Math.min(current + 1, TUTORIAL_STEPS.length - 1)
        )
      } else if (event.key === 'ArrowLeft') {
        setStepIndex((current) => Math.max(current - 1, 0))
      } else if (event.key === 'Tab') {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ) ?? []
        )

        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const step = TUTORIAL_STEPS[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1
  const progress = ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sentia-tutorial-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d1117] text-slate-100 shadow-2xl shadow-black/60"
      >
        <header className="border-b border-slate-800 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded border border-sky-800/70 bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-sky-300">
                  Essential
                </span>
                <span className="text-xs text-slate-500">
                  Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
                </span>
              </div>

              <h2
                id="sentia-tutorial-title"
                className="mt-2 text-xl font-semibold tracking-tight"
              >
                Sentia Tutorial
              </h2>
            </div>

            <button
              type="button"
              autoFocus
              aria-label="Close tutorial"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              X
            </button>
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[210px_minmax(0,1fr)]">
          <nav
            aria-label="Tutorial sections"
            className={`${styles.scrollArea} hidden overflow-y-auto border-r border-slate-800 bg-[#0a0d12] p-3 md:block`}
          >
            {TUTORIAL_STEPS.map((tutorialStep, index) => (
              <button
                key={tutorialStep.label}
                type="button"
                aria-current={index === stepIndex ? 'step' : undefined}
                onClick={() => setStepIndex(index)}
                className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                  index === stepIndex
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-700 text-[10px]">
                  {index + 1}
                </span>
                <span>{tutorialStep.label}</span>
              </button>
            ))}
          </nav>

          <main className={`${styles.scrollArea} min-h-0 overflow-y-auto px-5 py-6 sm:px-8`}>
            <div className="mx-auto max-w-2xl" aria-live="polite">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                {step.label}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {step.summary}
              </p>

              <div className="mt-6 space-y-3">
                {step.items.map((item, index) => (
                  <article
                    key={item.title}
                    className="rounded-lg border border-slate-800 bg-[#11151c] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-medium text-slate-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-medium text-slate-100">
                            {item.title}
                          </h4>
                          {item.keys && (
                            <kbd className="rounded border border-slate-700 bg-[#090c11] px-2 py-1 text-[10px] tracking-wide text-slate-300">
                              {item.keys}
                            </kbd>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-slate-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="mt-5 rounded-lg border border-sky-900/60 bg-sky-950/20 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-sky-400">
                  Good to know
                </p>
                <p className="mt-1 text-xs leading-5 text-sky-100/70">
                  {step.tip}
                </p>
              </aside>
            </div>
          </main>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-slate-800 bg-[#0a0d12] px-5 py-4 sm:px-6">
          <button
            type="button"
            disabled={isFirstStep}
            onClick={() => setStepIndex((current) => current - 1)}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Back
          </button>

          <span className="text-[10px] uppercase tracking-wider text-slate-600">
            Arrow keys also navigate
          </span>

          <button
            type="button"
            onClick={() => {
              if (isLastStep) {
                onClose()
              } else {
                setStepIndex((current) => current + 1)
              }
            }}
            className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </footer>
      </div>
    </div>
  )
}
