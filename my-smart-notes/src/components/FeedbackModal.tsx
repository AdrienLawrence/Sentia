'use client'

import {
  FormEvent,
  useEffect,
  useRef,
  useState
} from 'react'

import { useDialogKeyboard } from '@/lib/accessibility/useDialogKeyboard'

type FeedbackCategory =
  | 'bug'
  | 'idea'
  | 'experience'
  | 'other'

interface FeedbackItem {
  id: string
  category: FeedbackCategory
  message: string
  rating: number | null
  contact_allowed: boolean
  status: 'submitted' | 'reviewing' | 'planned' | 'resolved'
  created_at: string
}

interface FeedbackModalProps {
  isOpen: boolean
  email?: string | null
  onClose: () => void
}

const CATEGORIES: Array<{
  value: FeedbackCategory
  label: string
  description: string
}> = [
  { value: 'bug', label: 'Bug', description: 'Something broke' },
  { value: 'idea', label: 'Idea', description: 'A feature or improvement' },
  {
    value: 'experience',
    label: 'Experience',
    description: 'Usability or design feedback'
  },
  { value: 'other', label: 'Other', description: 'Anything else' }
]

export function FeedbackModal({
  isOpen,
  email,
  onClose
}: FeedbackModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] =
    useState<FeedbackCategory>('experience')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [contactAllowed, setContactAllowed] = useState(false)
  const [includeContext, setIncludeContext] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [history, setHistory] = useState<FeedbackItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  useDialogKeyboard({
    closeOnEscape: false,
    dialogRef,
    isOpen,
    onClose
  })

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false

    const loadHistory = async () => {
      setIsLoadingHistory(true)
      setHistoryError(null)

      try {
        const response = await fetch('/api/feedback')

        if (!response.ok) {
          throw new Error('Could not load feedback history.')
        }

        const items: FeedbackItem[] = await response.json()

        if (!cancelled) {
          setHistory(items)
        }
      } catch {
        if (!cancelled) {
          setHistoryError('Could not load feedback history.')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const trimmedMessage = message.trim()

    if (trimmedMessage.length < 10) {
      setSubmitError('Please include at least 10 characters.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmittedId(null)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category,
          message: trimmedMessage,
          rating: rating ?? undefined,
          contactAllowed,
          includeContext,
          pagePath: window.location.pathname
        })
      })

      if (!response.ok) {
        let errorMessage = 'Could not submit feedback.'

        try {
          const body = await response.json()
          if (typeof body?.error === 'string') {
            errorMessage = body.error
          }
        } catch {
          // Keep the user-safe fallback.
        }

        throw new Error(errorMessage)
      }

      const created: FeedbackItem = await response.json()
      setHistory((current) => [created, ...current].slice(0, 12))
      setSubmittedId(created.id)
      setMessage('')
      setRating(null)
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Could not submit feedback.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#11151c] shadow-2xl shadow-black/50"
      >
        <header className="flex items-start justify-between gap-6 border-b border-slate-800 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="feedback-title"
                className="text-lg font-semibold tracking-tight text-slate-50"
              >
                Help shape Sentia
              </h2>
              <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Feedback
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Tell me what should improve next. Every submission is tracked.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close feedback"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 p-5 sm:p-6"
          >
            {submittedId && (
              <div
                role="status"
                className="rounded-lg border border-emerald-900/70 bg-emerald-950/35 px-4 py-3"
              >
                <p className="text-sm font-medium text-emerald-200">
                  Feedback submitted. Thank you.
                </p>
                <p className="mt-1 text-xs text-emerald-400/80">
                  Reference {submittedId.slice(0, 8).toUpperCase()}
                </p>
              </div>
            )}

            <fieldset>
              <legend className="text-xs font-medium uppercase tracking-wider text-slate-500">
                What kind of feedback is this?
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {CATEGORIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={category === option.value}
                    onClick={() => setCategory(option.value)}
                    className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                      category === option.value
                        ? 'border-slate-500 bg-slate-700/80 text-slate-50'
                        : 'border-slate-800 bg-[#0d1117] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs opacity-70">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="feedback-message"
                className="text-xs font-medium uppercase tracking-wider text-slate-500"
              >
                Details
              </label>
              <textarea
                id="feedback-message"
                value={message}
                maxLength={2000}
                rows={7}
                required
                placeholder="What happened, what did you expect, or what would make Sentia better?"
                onChange={(event) => {
                  setMessage(event.target.value)
                  if (submitError) setSubmitError(null)
                }}
                className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-[#0d1117] px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
              />
              <div className="mt-1 flex justify-between gap-4 text-xs">
                <span className="text-red-300">{submitError}</span>
                <span
                  className={`ml-auto ${
                    message.trim().length < 10 && message.trim().length > 0
                      ? 'text-red-400'
                      : 'text-slate-600'
                  }`}
                >
                  {message.length}/2000
                </span>
              </div>
            </div>

            <fieldset>
              <legend className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Overall experience <span className="normal-case tracking-normal">(optional)</span>
              </legend>
              <div className="mt-3 flex items-center gap-1" aria-label="Experience rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${value} out of 5`}
                    aria-pressed={rating === value}
                    onClick={() => setRating(rating === value ? null : value)}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors ${
                      rating !== null && value <= rating
                        ? 'bg-slate-700 text-amber-200'
                        : 'text-slate-600 hover:bg-slate-800 hover:text-slate-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 text-xs text-slate-500">
                  {rating ? `${rating} of 5` : 'Not rated'}
                </span>
              </div>
            </fieldset>

            <div className="space-y-3 rounded-lg border border-slate-800 bg-[#0d1117]/70 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={contactAllowed}
                  onChange={(event) => setContactAllowed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-slate-500"
                />
                <span>
                  <span className="block text-sm text-slate-300">
                    You may contact me about this
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Uses {email || 'the email on your account'}.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(event) => setIncludeContext(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-slate-500"
                />
                <span>
                  <span className="block text-sm text-slate-300">
                    Include technical context
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    Includes this page and browser type—not notebook content.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-600">
                Feedback is linked to your account so you can track it.
              </p>
              <button
                type="submit"
                disabled={isSubmitting || message.trim().length < 10}
                className="shrink-0 rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            </div>
          </form>

          <aside className="border-t border-slate-800 bg-[#0d1117]/55 p-5 lg:border-l lg:border-t-0 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Your Recent Feedback
              </h3>
              {history.length > 0 && (
                <span className="text-xs text-slate-600">
                  {history.length}
                </span>
              )}
            </div>

            {isLoadingHistory ? (
              <p className="mt-4 text-sm text-slate-600">Loading…</p>
            ) : historyError ? (
              <p className="mt-4 text-sm text-red-300">{historyError}</p>
            ) : history.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-800 p-4 text-center">
                <p className="text-sm text-slate-500">No feedback yet.</p>
                <p className="mt-1 text-xs text-slate-700">
                  Your submissions will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {history.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-slate-800 bg-[#11151c] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium capitalize text-slate-300">
                        {item.category}
                      </span>
                      <FeedbackStatus status={item.status} />
                    </div>
                    <p className="mt-2 max-h-16 overflow-hidden text-xs leading-5 text-slate-500">
                      {item.message}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-700">
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      <span>{item.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function FeedbackStatus({ status }: { status: FeedbackItem['status'] }) {
  const labels = {
    submitted: 'Submitted',
    reviewing: 'Reviewing',
    planned: 'Planned',
    resolved: 'Resolved'
  }

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        status === 'resolved'
          ? 'border-emerald-900/70 bg-emerald-950/40 text-emerald-300'
          : status === 'planned'
            ? 'border-violet-900/70 bg-violet-950/35 text-violet-300'
            : status === 'reviewing'
              ? 'border-amber-900/70 bg-amber-950/35 text-amber-300'
              : 'border-slate-700 bg-slate-800/70 text-slate-400'
      }`}
    >
      {labels[status]}
    </span>
  )
}
