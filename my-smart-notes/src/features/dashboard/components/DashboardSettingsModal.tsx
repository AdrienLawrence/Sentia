import { useRef, useState } from 'react'

import { useDialogKeyboard } from '@/lib/accessibility/useDialogKeyboard'
import { LEGAL_DOCUMENT_OPEN_EVENT } from '@/features/legal/constants'

interface DashboardSettingsModalProps {
  accountProvider: string
  canResetPassword: boolean
  darkEditorPaper: boolean
  defaultNotebookName: string
  userEmail?: string
  onClose: () => void
  onDefaultNotebookNameChange: (name: string) => void
  onDeleteAccount: (confirmation: string) => Promise<void>
  onOpenFeedback: () => void
  onOpenTutorial: () => void
  onSendPasswordReset: () => Promise<void>
  onSignOut: () => void
  onThemeChange: (dark: boolean) => void
}

export function DashboardSettingsModal({
  accountProvider,
  canResetPassword,
  darkEditorPaper,
  defaultNotebookName,
  userEmail,
  onClose,
  onDefaultNotebookNameChange,
  onDeleteAccount,
  onOpenFeedback,
  onOpenTutorial,
  onSendPasswordReset,
  onSignOut,
  onThemeChange
}: DashboardSettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [showDeleteAccount, setShowDeleteAccount] =
    useState(false)
  const [deleteConfirmation, setDeleteConfirmation] =
    useState('')
  const [accountError, setAccountError] = useState('')
  const [accountNotice, setAccountNotice] = useState('')
  const [accountAction, setAccountAction] = useState<
    'delete' | 'recovery' | null
  >(null)

  useDialogKeyboard({
    dialogRef,
    onClose
  })

  const handlePasswordReset = async () => {
    setAccountError('')
    setAccountNotice('')
    setAccountAction('recovery')

    try {
      await onSendPasswordReset()
      setAccountNotice(
        'A password recovery link was sent if this account supports password sign-in.'
      )
    } catch (error: unknown) {
      setAccountError(
        error instanceof Error
          ? error.message
          : 'The recovery link could not be sent.'
      )
    } finally {
      setAccountAction(null)
    }
  }

  const handleDeleteAccount = async () => {
    setAccountError('')
    setAccountNotice('')
    setAccountAction('delete')

    try {
      await onDeleteAccount(deleteConfirmation)
    } catch (error: unknown) {
      setAccountError(
        error instanceof Error
          ? error.message
          : 'The account could not be deleted.'
      )
      setAccountAction(null)
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-settings-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-[#11151c] p-6 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between gap-6 border-b border-slate-800 pb-4">
          <div>
            <h2
              id="dashboard-settings-title"
              className="text-lg font-semibold tracking-tight text-slate-50"
            >
              Settings
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Dashboard and notebook preferences.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            ×
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          <section className="py-5">
            <div className="rounded-lg border border-sky-900/60 bg-sky-950/20 p-4">
              <div className="flex items-center justify-between gap-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-sky-300">
                      Tutorial
                    </h3>
                    <span className="rounded border border-sky-800/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-400">
                      Essential
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    Learn every Sentia workflow
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    A complete guided tour of notebooks, pages,
                    editing, commands, recovery, and account tools.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onOpenTutorial}
                  className="shrink-0 rounded-md border border-sky-800/70 bg-sky-950/40 px-3 py-2 text-sm text-sky-200 transition-colors hover:bg-sky-900/40 hover:text-sky-100"
                >
                  Start
                </button>
              </div>
            </div>
          </section>

          <section className="py-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Account
            </h3>

            <div className="mt-3 rounded-lg border border-slate-800 bg-[#0d1117] p-4">
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-slate-100">
                    {userEmail}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Sign-in method
                  </dt>
                  <dd className="mt-0.5 text-sm text-slate-300">
                    {accountProvider}
                  </dd>
                </div>
              </dl>

              {(accountError || accountNotice) && (
                <div
                  role={accountError ? 'alert' : 'status'}
                  className={`mt-4 rounded-md border px-3 py-2 text-xs leading-5 ${
                    accountError
                      ? 'border-red-900/70 bg-red-950/40 text-red-300'
                      : 'border-sky-900/70 bg-sky-950/30 text-sky-200'
                  }`}
                >
                  {accountError || accountNotice}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {canResetPassword && (
                  <button
                    type="button"
                    onClick={() => void handlePasswordReset()}
                    disabled={accountAction !== null}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {accountAction === 'recovery'
                      ? 'Sending…'
                      : 'Change Password'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={accountAction !== null}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Sign Out
                </button>
              </div>

              {!canResetPassword && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Password management is handled by your sign-in
                  provider.
                </p>
              )}
            </div>
          </section>

          <section className="py-5">
            <label
              htmlFor="default-notebook-name"
              className="text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              New Notebooks
            </label>

            <div className="mt-3 flex items-center justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Default notebook name
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Used as the starting name for new notebooks.
                </p>
              </div>

              <input
                id="default-notebook-name"
                type="text"
                value={defaultNotebookName}
                maxLength={100}
                onChange={(event) =>
                  onDefaultNotebookNameChange(event.target.value)
                }
                className="w-44 rounded-md border border-slate-700 bg-[#0d1117] px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-500"
              />
            </div>
          </section>

          <section className="py-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Appearance
            </h3>

            <div className="mt-3 flex items-center justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Application theme
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Use a light or dark theme across Sentia.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Application theme"
                className="flex shrink-0 rounded-md border border-slate-700 bg-[#0d1117] p-1"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!darkEditorPaper}
                  onClick={() => onThemeChange(false)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    !darkEditorPaper
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Light
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={darkEditorPaper}
                  onClick={() => onThemeChange(true)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    darkEditorPaper
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
          </section>

          <section className="py-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Feedback &amp; Support
            </h3>

            <div className="mt-3 flex items-center justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Help improve Sentia
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Report bugs, suggest ideas, and track your
                  submissions.
                </p>
              </div>

              <button
                type="button"
                onClick={onOpenFeedback}
                className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Open Feedback
              </button>
            </div>
          </section>

          <section className="py-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Legal &amp; Privacy
            </h3>

            <div className="mt-3 flex items-center justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Privacy Policy and Terms
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Revisit the documents accepted for this account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  window.dispatchEvent(
                    new Event(LEGAL_DOCUMENT_OPEN_EVENT)
                  )
                }}
                className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                View Documents
              </button>
            </div>
          </section>

          <section className="py-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-red-400">
              Danger Zone
            </h3>

            {!showDeleteAccount ? (
              <div className="mt-3 flex items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Delete account
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Permanently remove your account and server-stored
                    Sentia data.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAccountError('')
                    setAccountNotice('')
                    setShowDeleteAccount(true)
                  }}
                  className="shrink-0 rounded-md border border-red-900/80 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-950/40"
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-red-900/70 bg-red-950/20 p-4">
                <p className="text-sm font-medium text-red-200">
                  This cannot be undone
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  This removes notebooks, pages, AI vectors, drawings,
                  feedback, and the Sentia sign-in identity. Exported
                  files and local Markdown copies remain on your
                  device. Type <strong className="text-slate-200">DELETE</strong>{' '}
                  to continue.
                </p>
                <label
                  htmlFor="delete-account-confirmation"
                  className="mt-4 block text-xs font-medium text-slate-400"
                >
                  Confirmation
                </label>
                <input
                  id="delete-account-confirmation"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(event.target.value)
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-md border border-red-900/70 bg-[#0d1117] px-3 py-2 text-sm text-slate-100 outline-none focus:border-red-700"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteAccount(false)
                      setDeleteConfirmation('')
                      setAccountError('')
                    }}
                    disabled={accountAction === 'delete'}
                    className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount()}
                    disabled={
                      deleteConfirmation !== 'DELETE' ||
                      accountAction !== null
                    }
                    className="rounded-md border border-red-800 bg-red-950/60 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {accountAction === 'delete'
                      ? 'Deleting…'
                      : 'Permanently Delete'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
