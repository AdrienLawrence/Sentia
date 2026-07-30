import type { NotebookPage } from '../../editor/model/types'

import { tiptapDocumentToPlainText } from './content'
import { tiptapDocumentToMarkdown } from './markdown'

export { tiptapDocumentToMarkdown } from './markdown'

export type ExportFormat = 'markdown' | 'pdf' | 'text'

function safeFileName(value: string) {
  const safeName = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return safeName || 'Sentia Export'
}

function downloadText(
  content: string,
  fileName: string,
  extension: string,
  mimeType: string
) {
  const blob = new Blob([content], {
    type: `${mimeType};charset=utf-8`
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `${safeFileName(fileName)}.${extension}`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function exportPagesToMarkdown(
  notebookName: string,
  pages: NotebookPage[],
  fileName: string
) {
  const multiplePages = pages.length > 1
  const sections = pages.map((page) => {
    const title = page.title?.trim() || 'Untitled Page'
    const heading = multiplePages ? `## ${title}` : `# ${title}`
    const body = tiptapDocumentToMarkdown(page.content)

    return body ? `${heading}\n\n${body}` : heading
  })
  const content = multiplePages
    ? `# ${notebookName || 'My Notebook'}\n\n${sections.join(
        '\n\n---\n\n'
      )}\n`
    : `${sections[0] ?? '# Untitled Page'}\n`

  downloadText(content, fileName, 'md', 'text/markdown')
}

export function exportPagesToPlainText(
  notebookName: string,
  pages: NotebookPage[],
  fileName: string
) {
  const multiplePages = pages.length > 1
  const sections = pages.map((page) => {
    const title = page.title?.trim() || 'Untitled Page'
    const body = tiptapDocumentToPlainText(page.content).trim()

    return body ? `${title}\n\n${body}` : title
  })
  const content = multiplePages
    ? `${notebookName || 'My Notebook'}\n${'='.repeat(
        (notebookName || 'My Notebook').length
      )}\n\n${sections.join('\n\n-----\n\n')}\n`
    : `${sections[0] ?? 'Untitled Page'}\n`

  downloadText(content, fileName, 'txt', 'text/plain')
}
