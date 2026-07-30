import type { DashboardNotebook } from '../model/types'

export function formatNotebookDate(
  notebook: DashboardNotebook,
  today = new Date()
) {
  const lastOpened = notebook.last_opened_at
    ? new Date(notebook.last_opened_at)
    : null
  const formatDate = (date: Date) =>
    date.toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year:
        date.getFullYear() === today.getFullYear()
          ? undefined
          : 'numeric'
    })

  if (lastOpened) {
    const openedToday =
      lastOpened.getFullYear() === today.getFullYear() &&
      lastOpened.getMonth() === today.getMonth() &&
      lastOpened.getDate() === today.getDate()

    if (openedToday) {
      return `Opened ${lastOpened.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      })}`
    }

    return `Opened ${formatDate(lastOpened)}`
  }

  return `Created ${formatDate(new Date(notebook.created_at))}`
}
