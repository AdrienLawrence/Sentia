export interface DrawBox {
  id: string
  x_position: number
  y_position: number
  width: number
  height: number
  elements?: Array<unknown>
}

export interface Notebook {
  id: string
  name: string
  revision?: number
  style: string
}

export interface NotebookPage {
  id: string
  user_id?: string
  editorKey?: string
  title?: string
  page_number?: number
  updated_at?: string | null
  content?: JSONContent
  notebook?: Notebook
  notebook_id?: string
  draw_boxes?: DrawBox[]
  isPendingCreation?: boolean
}

export interface DeletedPageEntry {
  page: NotebookPage
  originalIndex: number
}

export interface AiCitation {
  number: number
  pageId: string
  pageTitle: string
  excerpt: string
  selectionText?: string
}

export interface AiExternalCitation {
  url: string
  title: string
  startIndex: number
  endIndex: number
}

export type AiAction =
  | 'continue'
  | 'check'
  | 'rewrite'
  | 'summarize'
  | 'ask'

export type AiTarget = 'page' | 'selection'

export interface AiSelectionSnapshot {
  from: number
  to: number
  text: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  action?: AiAction
  target?: AiTarget
  selection?: AiSelectionSnapshot
  notebookCitations?: AiCitation[]
  externalCitations?: AiExternalCitation[]
  usedExternalResearch?: boolean
}

export interface AiInsertRequest {
  id: string
  text: string
}

export interface AiHighlightRequest {
  id: string
  text: string
}

export interface EditorReplaceRequest {
  id: string
  sourceMessageId: string
  target: AiTarget
  text?: string
  content?: JSONContent
  selection?: AiSelectionSnapshot
}

export interface AiReplaceRequest extends EditorReplaceRequest {
  text: string
}
import type { JSONContent } from '@tiptap/core'
