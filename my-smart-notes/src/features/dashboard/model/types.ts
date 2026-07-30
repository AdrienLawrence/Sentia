export interface DashboardNotebook {
  id: string
  name: string
  style: string
  created_at: string
  last_opened_at?: string | null
  revision: number
  user_id: string
  latestPageId?: string | null
  _count: {
    pages: number
  }
}

export interface PendingNotebookDeletion {
  notebookId: string
  requestedAt: number
}
