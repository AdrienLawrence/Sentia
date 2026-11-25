import type { KeyboardEvent } from 'react'

export function handleMenuKeyboardNavigation(
  event: KeyboardEvent<HTMLDivElement>,
  onEscape: () => void
) {
  if (event.key === 'Escape') {
    event.preventDefault()
    onEscape()
    return
  }

  if (
    !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
  ) {
    return
  }

  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([disabled])'
    )
  ).filter((item) => item.offsetParent !== null)
  const currentIndex = items.indexOf(
    event.target as HTMLElement
  )

  if (currentIndex === -1 || items.length === 0) return

  event.preventDefault()

  if (event.key === 'Home') {
    items[0].focus()
  } else if (event.key === 'End') {
    items[items.length - 1].focus()
  } else {
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex =
      (currentIndex + direction + items.length) % items.length
    items[nextIndex].focus()
  }
}
