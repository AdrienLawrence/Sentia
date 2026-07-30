import { useRef } from 'react'

import { useDialogKeyboard } from '@/lib/accessibility/useDialogKeyboard'

interface DeleteNotebookModalProps {
  isDeleting: boolean
  notebookName: string
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteNotebookModal({
  isDeleting,
  notebookName,
  onCancel,
  onConfirm
}: DeleteNotebookModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useDialogKeyboard({
    dialogRef,
    onClose: () => {
      if (!isDeleting) onCancel()
    }
  })

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isDeleting
        ) {
          onCancel()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dashboard-notebook-title"
        aria-describedby="delete-dashboard-notebook-description"
        className="w-full max-w-md rounded-xl border border-slate-700 bg-[#11151c] p-6 shadow-2xl shadow-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="delete-dashboard-notebook-title"
          className="text-xl font-bold text-gray-50"
        >
          Delete Notebook
        </h2>

        <p
          id="delete-dashboard-notebook-description"
          className="mt-3 leading-6 text-gray-300"
        >
          Delete “{notebookName}”? This cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            autoFocus
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="rounded-lg border border-red-900 bg-red-950 px-4 py-2 text-red-200 hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? 'Deleting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
