'use client'

import { useEffect, useRef, useState } from 'react'
import tutorialStyles from './TutorialModal.module.css'

type EditorMode = 'read' | 'write'

interface EditorShowcaseTourProps {
  isOpen: boolean
  currentMode: EditorMode
  onModeChange: (mode: EditorMode) => void
  onComplete: () => void
}

interface ShowcaseStep {
  label: string
  title: string
  description: string
  selector?: string
  mode?: EditorMode
  detail: string
}

const SHOWCASE_STEPS: ShowcaseStep[] = [
  {
    label: 'Welcome',
    title: 'Meet your Sentia editor',
    description:
      'This first-use showcase points out the real controls you will use while writing. Move through every step to finish onboarding.',
    detail:
      'Each step explains each control. Skip step moves past the current explanation, but the showcase completes only at the final step.'
  },
  {
    label: 'Notebook',
    title: 'Name the notebook',
    description:
      'Select this field and type a name. My Notebook is only a placeholder, so your first character replaces it immediately.',
    selector: '[data-editor-tour="notebook-name"]',
    mode: 'write',
    detail:
      'Notebook names save automatically.'
  },
  {
    label: 'Modes',
    title: 'Choose Read or Write',
    description:
      'Write includes editing tools. Read replaces those tools with a bulleted page list used for navigation and reordering.',
    selector: '[data-editor-tour="mode-controls"]',
    mode: 'write',
    detail:
      'The showcase will switch modes for you when a later step needs a Read-only control.'
  },
  {
    label: 'Tools',
    title: 'Format the current selection',
    description:
      'The Write sidebar contains various emphasis, font size, color, alignment, and list controls.',
    selector: '[data-editor-tour="writing-tools"]',
    mode: 'write',
    detail:
      'Toolbar actions preserve editor focus, so formatting does not make you lose your writing position.'
  },
  {
    label: 'Page title',
    title: 'Give each page a clear title',
    description:
      'Select Page Title and begin typing. The placeholder clears immediately and the title saves automatically.',
    selector: '[data-editor-tour="page-title"]',
    mode: 'write',
    detail:
      'Page titles appear in the Read-mode page list and make large notebooks easy to navigate.'
  },
  {
    label: 'Writing',
    title: 'This is the writing surface',
    description:
      'Write normally here. This page serves the same purpose as many standard typing apps. Pages extend as you overfill them, rather than cutting off into the next page',
    selector: '[data-editor-tour="writing-surface"]',
    mode: 'write',
    detail:
      'Ctrl/Cmd + Z undoes text while the caret is here. Content saves after a short pause in typing.'
  },
  {
    label: 'Navigation',
    title: 'Move between pages',
    description:
      'The left arrow opens the previous page. The right arrow opens the next page, or displays a plus at the notebook end to create one.',
    selector: '[data-editor-tour="page-navigation"]',
    mode: 'write',
    detail:
      'A new page spawns for you to type into instantly while its creation request completes in the background.'
  },
  {
    label: 'Page list',
    title: 'Navigate and reorder in Read mode',
    description:
      'Select a bulleted title to open that page. Drag a title above or below another title to change the order and it saves automatically.',
    selector: '[data-editor-tour="read-page-list"]',
    mode: 'read',
    detail:
      'With focus outside editable controls, Backspace removes the selected page and Ctrl/Cmd + Z restores deleted pages newest-first.'
  },
  {
    label: 'Utilities',
    title: 'Use FILE and SETTINGS',
    description:
      'FILE contains Rename Notebook, Delete Notebook, and Home. SETTINGS contains appearance, commands, the full tutorial, and this replayable showcase.',
    selector: '[data-editor-tour="editor-utilities"]',
    mode: 'write',
    detail:
      'Return to Editor Settings whenever you want to replay this interactive tour.'
  },
  {
    label: 'Complete',
    title: 'You are ready to write',
    description:
      'You have seen the complete editor workflow. Finish this step to unlock the editor and remember onboarding on this browser.',
    detail:
      'For a deeper reference covering the dashboard, feedback, account tools, and every command, open the full Sentia Tutorial in Settings.'
  }
]

const TOOLTIP_WIDTH = 360
const VIEWPORT_GAP = 16
const TARGET_PADDING = 7

export function EditorShowcaseTour({
  isOpen,
  currentMode,
  onModeChange,
  onComplete
}: EditorShowcaseTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const onModeChangeRef = useRef(onModeChange)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onModeChangeRef.current = onModeChange
    onCompleteRef.current = onComplete
  }, [onComplete, onModeChange])

  useEffect(() => {
    if (!isOpen) return
    setStepIndex(0)
  }, [isOpen])

  const step = SHOWCASE_STEPS[stepIndex]

  useEffect(() => {
    if (!isOpen) return

    if (step.mode && step.mode !== currentMode) {
      setTargetRect(null)
      onModeChangeRef.current(step.mode)
      return
    }

    const updateTarget = () => {
      if (!step.selector) {
        setTargetRect(null)
        return
      }

      const target = document.querySelector<HTMLElement>(step.selector)

      if (!target) {
        setTargetRect(null)
        return
      }

      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      setTargetRect(target.getBoundingClientRect())
    }

    const frame = requestAnimationFrame(updateTarget)
    const delayedUpdate = window.setTimeout(updateTarget, 120)

    window.addEventListener('resize', updateTarget)
    window.addEventListener('scroll', updateTarget, true)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(delayedUpdate)
      window.removeEventListener('resize', updateTarget)
      window.removeEventListener('scroll', updateTarget, true)
    }
  }, [currentMode, isOpen, step])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setStepIndex((current) =>
          Math.min(current + 1, SHOWCASE_STEPS.length - 1)
        )
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setStepIndex((current) => Math.max(current - 1, 0))
      } else if (event.key === 'Tab') {
        const buttons = Array.from(
          tooltipRef.current?.querySelectorAll<HTMLButtonElement>(
            'button:not([disabled])'
          ) ?? []
        )

        if (buttons.length === 0) return

        const first = buttons[0]
        const last = buttons[buttons.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === SHOWCASE_STEPS.length - 1
  const progress = ((stepIndex + 1) / SHOWCASE_STEPS.length) * 100
  const tooltipPosition = getTooltipPosition(targetRect)

  const advance = () => {
    setStepIndex((current) =>
      Math.min(current + 1, SHOWCASE_STEPS.length - 1)
    )
  }

  return (
    <div className="fixed inset-0 z-[1300]" aria-live="polite">
      {!targetRect && (
        <div
          className="absolute inset-0 bg-black/70"
          aria-hidden="true"
          onMouseDown={(event) => event.preventDefault()}
        />
      )}

      {targetRect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[1301] rounded-lg border-2 border-sky-300 transition-all duration-200"
          style={getHighlightStyle(targetRect)}
        />
      )}

      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-showcase-title"
        className={`${tutorialStyles.scrollArea} fixed z-[1302] max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-[360px] overflow-y-auto rounded-xl border border-sky-800/70 bg-[#0d1117] p-5 text-slate-100 shadow-2xl shadow-black/60`}
        style={tooltipPosition}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="rounded border border-sky-800/70 bg-sky-950/40 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-sky-300">
            Interactive editor tour
          </span>
          <span className="text-[10px] text-slate-500">
            {stepIndex + 1} / {SHOWCASE_STEPS.length}
          </span>
        </div>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-400">
          {step.label}
        </p>
        <h2
          id="editor-showcase-title"
          className="mt-1.5 text-lg font-semibold tracking-tight text-white"
        >
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          {step.description}
        </p>
        <p className="mt-3 rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs leading-5 text-slate-400">
          {step.detail}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isFirstStep}
            onClick={() => setStepIndex((current) => current - 1)}
            className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Back
          </button>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <button
                type="button"
                onClick={advance}
                className="rounded-md px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-900 hover:text-slate-300"
              >
                Skip step
              </button>
            )}

            <button
              type="button"
              autoFocus
              onClick={() => {
                if (isLastStep) {
                  onCompleteRef.current()
                } else {
                  advance()
                }
              }}
              className="rounded-md border border-sky-700/70 bg-sky-900/50 px-4 py-2 text-xs font-medium text-sky-100 transition-colors hover:bg-sky-800/60"
            >
              {isLastStep ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-[9px] uppercase tracking-wider text-slate-600">
          Complete every step to enter the editor
        </p>
      </div>
    </div>
  )
}

function getTooltipPosition(targetRect: DOMRect | null) {
  if (!targetRect || typeof window === 'undefined') {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)'
    }
  }

  const estimatedHeight = 420
  const rightSpace = window.innerWidth - targetRect.right
  const leftSpace = targetRect.left
  const belowSpace = window.innerHeight - targetRect.bottom
  const top = clamp(
    targetRect.top,
    VIEWPORT_GAP,
    window.innerHeight - estimatedHeight - VIEWPORT_GAP
  )

  if (rightSpace >= TOOLTIP_WIDTH + VIEWPORT_GAP * 2) {
    return {
      top,
      left: targetRect.right + VIEWPORT_GAP
    }
  }

  if (leftSpace >= TOOLTIP_WIDTH + VIEWPORT_GAP * 2) {
    return {
      top,
      left: targetRect.left - TOOLTIP_WIDTH - VIEWPORT_GAP
    }
  }

  const left = clamp(
    targetRect.left,
    VIEWPORT_GAP,
    window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_GAP
  )

  if (belowSpace >= estimatedHeight + VIEWPORT_GAP) {
    return {
      top: targetRect.bottom + VIEWPORT_GAP,
      left
    }
  }

  return {
    top: Math.max(VIEWPORT_GAP, targetRect.top - estimatedHeight - VIEWPORT_GAP),
    left
  }
}

function getHighlightStyle(targetRect: DOMRect) {
  const top = Math.max(4, targetRect.top - TARGET_PADDING)
  const left = Math.max(4, targetRect.left - TARGET_PADDING)

  return {
    top,
    left,
    width: Math.max(
      1,
      Math.min(
        window.innerWidth - left - 4,
        targetRect.width + TARGET_PADDING * 2
      )
    ),
    height: Math.max(
      1,
      Math.min(
        window.innerHeight - top - 4,
        targetRect.height + TARGET_PADDING * 2
      )
    ),
    boxShadow:
      '0 0 0 4px rgba(125, 211, 252, 0.18), 0 0 0 9999px rgba(0, 0, 0, 0.72), 0 12px 45px rgba(0, 0, 0, 0.45)'
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}
