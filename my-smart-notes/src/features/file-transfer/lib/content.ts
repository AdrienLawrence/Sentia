import type { JSONContent } from '@tiptap/core'

const SUPPORTED_EXTENSIONS = new Set([
  'md',
  'markdown',
  'pdf',
  'txt'
])

export const IMPORT_FILE_ACCEPT =
  '.md,.markdown,.pdf,.txt,application/pdf,text/markdown,text/plain'
export const MAX_IMPORT_FILES = 100
export const MAX_IMPORT_FILE_BYTES = 10_000_000
export const MAX_IMPORT_TOTAL_BYTES = 50_000_000
export const MAX_IMPORTED_TEXT_LENGTH = 400_000
const MAX_IMPORTED_LINES = 8_000

export interface ImportedDocument {
  content: JSONContent
  sourceName: string
  title: string
}

function fileExtension(name: string) {
  const separatorIndex = name.lastIndexOf('.')

  return separatorIndex < 0
    ? ''
    : name.slice(separatorIndex + 1).toLocaleLowerCase()
}

export function isSupportedImportFile(file: File) {
  return SUPPORTED_EXTENSIONS.has(fileExtension(file.name))
}

export function titleFromFileName(name: string) {
  const withoutPath = name.split(/[\\/]/).pop() || 'Imported Page'
  const separatorIndex = withoutPath.lastIndexOf('.')
  const title =
    separatorIndex > 0
      ? withoutPath.slice(0, separatorIndex)
      : withoutPath

  return title.trim().slice(0, 200) || 'Imported Page'
}

export function notebookNameFromFiles(files: File[]) {
  const firstRelativePath = files[0]?.webkitRelativePath
  const rootFolder = firstRelativePath?.split('/')[0]?.trim()

  if (rootFolder) return rootFolder.slice(0, 100)
  if (files.length === 1) {
    return titleFromFileName(files[0].name).slice(0, 100)
  }

  return 'Imported Notebook'
}

function textNode(text: string): JSONContent {
  return {
    type: 'text',
    text
  }
}

function paragraph(text = ''): JSONContent {
  return {
    type: 'paragraph',
    ...(text ? { content: [textNode(text)] } : {})
  }
}

function listItem(text: string): JSONContent {
  return {
    type: 'listItem',
    content: [paragraph(text)]
  }
}

export function plainTextToTiptapDocument(
  text: string
): JSONContent {
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .slice(0, MAX_IMPORTED_TEXT_LENGTH)
  const lines = normalized.split('\n').slice(0, MAX_IMPORTED_LINES)

  return {
    type: 'doc',
    content: lines.map((line) => paragraph(line))
  }
}

export function markdownToTiptapDocument(
  markdown: string
): JSONContent {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .slice(0, MAX_IMPORTED_TEXT_LENGTH)
    .split('\n')
    .slice(0, MAX_IMPORTED_LINES)
  const content: JSONContent[] = []
  let lineIndex = 0

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]
    const fence = line.match(/^\s*```/)

    if (fence) {
      const codeLines: string[] = []
      lineIndex += 1

      while (
        lineIndex < lines.length &&
        !/^\s*```/.test(lines[lineIndex])
      ) {
        codeLines.push(lines[lineIndex])
        lineIndex += 1
      }

      content.push({
        type: 'codeBlock',
        ...(codeLines.length > 0
          ? { content: [textNode(codeLines.join('\n'))] }
          : {})
      })
      lineIndex += 1
      continue
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/)

    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: [textNode(heading[2].trim())]
      })
      lineIndex += 1
      continue
    }

    const bullet = line.match(/^\s*[-*+]\s+(.+)$/)

    if (bullet) {
      const items: JSONContent[] = []

      while (lineIndex < lines.length) {
        const item = lines[lineIndex].match(/^\s*[-*+]\s+(.+)$/)
        if (!item) break
        items.push(listItem(item[1]))
        lineIndex += 1
      }

      content.push({ type: 'bulletList', content: items })
      continue
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)

    if (ordered) {
      const items: JSONContent[] = []

      while (lineIndex < lines.length) {
        const item = lines[lineIndex].match(
          /^\s*\d+[.)]\s+(.+)$/
        )
        if (!item) break
        items.push(listItem(item[1]))
        lineIndex += 1
      }

      content.push({ type: 'orderedList', content: items })
      continue
    }

    const quote = line.match(/^\s*>\s?(.*)$/)

    if (quote) {
      content.push({
        type: 'blockquote',
        content: [paragraph(quote[1])]
      })
      lineIndex += 1
      continue
    }

    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      content.push({ type: 'horizontalRule' })
      lineIndex += 1
      continue
    }

    content.push(paragraph(line))
    lineIndex += 1
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [paragraph()]
  }
}

export function tiptapDocumentToPlainText(
  content: unknown
): string {
  if (!content || typeof content !== 'object') return ''

  const node = content as {
    type?: string
    text?: string
    content?: unknown[]
  }

  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'

  const childText: string = (node.content ?? [])
    .map(tiptapDocumentToPlainText)
    .join('')

  if (
    node.type === 'paragraph' ||
    node.type === 'heading' ||
    node.type === 'codeBlock' ||
    node.type === 'blockquote' ||
    node.type === 'listItem'
  ) {
    return `${childText}\n`
  }

  return childText
}
