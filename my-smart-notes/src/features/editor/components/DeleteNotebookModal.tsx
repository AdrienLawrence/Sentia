import { useRef } from 'react'

import styles from '@/app/editor/[id]/Editor.module.css'
import { useDialogKeyboard } from '@/lib/accessibility/useDialogKeyboard'

interface DeleteNotebookModalProps {
  error: string | null
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteNotebookModal({
  error,
  isDeleting,
  onCancel,
  onConfirm
}: DeleteNotebookModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useDialogKeyboard({
    dialogRef,
    onClose: onCancel
  })

  return (
    <div
      className={styles.deleteNotebookBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '24px'
      }}
    >
      <div
        className={styles.deleteNotebookDialog}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-notebook-title"
        aria-describedby="delete-notebook-description"
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '12px',
          background: '#111827',
          border: '1px solid #374151',
          padding: '24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)'
        }}
      >
        <h2
          className={styles.deleteNotebookTitle}
          id="delete-notebook-title"
          style={{
            margin: 0,
            color: '#f9fafb',
            fontSize: '18px',
            fontWeight: 600,
            fontFamily: 'Geist'
          }}
        >
          Delete Notebook
        </h2>

        <p
          className={styles.deleteNotebookDescription}
          id="delete-notebook-description"
          style={{
            margin: '8px 0 0',
            color: '#9ca3af',
            fontSize: '14px',
            lineHeight: 1.5,
            fontFamily: 'Geist'
          }}
        >
          This cannot be undone. Continue?
        </p>

        {error && (
          <p
            className={styles.deleteNotebookError}
            role="alert"
            style={{
              margin: '14px 0 0',
              color: '#fca5a5',
              lineHeight: 1.4
            }}
          >
            {error}
          </p>
        )}

        <div
          className={styles.deleteNotebookActions}
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '22px',
            paddingTop: '16px',
            borderTop: '1px solid #374151'
          }}
        >
          <button
            className={styles.deleteNotebookConfirm}
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              border: '1px solid #6b3038',
              borderRadius: '6px',
              background: '#3b1d23',
              color: '#f1b5bc',
              padding: '9px 14px',
              fontFamily: 'Geist',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.65 : 1
            }}
          >
            {isDeleting ? 'Deleting...' : 'Confirm'}
          </button>

          <button
            className={styles.deleteNotebookCancel}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            autoFocus
            style={{
              border: '1px solid #64748b',
              borderRadius: '6px',
              background: '#475569',
              color: '#f8fafc',
              padding: '9px 14px',
              fontFamily: 'Geist',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.65 : 1
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
