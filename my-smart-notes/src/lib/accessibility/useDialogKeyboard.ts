'use client'

import {
  useEffect,
  useRef,
  type RefObject
} from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

interface UseDialogKeyboardOptions {
  closeOnEscape?: boolean
  dialogRef: RefObject<HTMLElement | null>
  isOpen?: boolean
  onClose: () => void
}

export function useDialogKeyboard({
  closeOnEscape = true,
  dialogRef,
  isOpen = true,
  onClose
}: UseDialogKeyboardOptions) {
  const onCloseRef = useRef(onClose)
  const initialFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  )
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previouslyFocused =
      activeElement &&
      !dialogRef.current?.contains(activeElement)
        ? activeElement
        : initialFocusRef.current

    const focusFirstControl = window.requestAnimationFrame(() => {
      const preferredControl =
        dialogRef.current?.querySelector<HTMLElement>(
          '[autofocus]'
        )
      const firstControl =
        dialogRef.current?.querySelector<HTMLElement>(
          FOCUSABLE_SELECTOR
        )

      ;(preferredControl || firstControl || dialogRef.current)?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return

      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.offsetParent !== null)

      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusFirstControl)
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [closeOnEscape, dialogRef, isOpen])
}
