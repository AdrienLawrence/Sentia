import type { ReactNode } from 'react'

import type { AiCitation, AiMessage } from '../model/types'

export function cleanChatFormatting(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/\s*\[Source\s+\d+\]/gi, '')
    .replace(/`{1,3}/g, '')
}

export function cleanAiReplacementText(text: string) {
  return text
    .split(/(```[\s\S]*?(?:```|$))/g)
    .map((section) =>
      section.startsWith('```')
        ? section
        : cleanChatFormatting(section)
    )
    .join('')
}

export function renderAiMessageText(
  message: AiMessage,
  onOpenNotebookCitation?: (citation: AiCitation) => void
) {
  const externalCitations = [...(message.externalCitations ?? [])]
    .filter(
      (citation) =>
        citation.startIndex >= 0 &&
        citation.endIndex > citation.startIndex &&
        citation.endIndex <= message.text.length
    )
    .sort((left, right) => left.startIndex - right.startIndex)
  const notebookCitations = new Map(
    (message.notebookCitations ?? []).map((citation) => [
      citation.number,
      citation
    ])
  )
  const ranges: Array<
    | {
        kind: 'external'
        startIndex: number
        endIndex: number
        url: string
        title: string
      }
    | {
        kind: 'notebook'
        startIndex: number
        endIndex: number
        citation: AiCitation
      }
  > = externalCitations.map((citation) => ({
    kind: 'external',
    ...citation
  }))

  for (const match of message.text.matchAll(/\[Source\s+(\d+)\]/gi)) {
    const citation = notebookCitations.get(Number(match[1]))

    if (citation && match.index !== undefined) {
      ranges.push({
        kind: 'notebook',
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        citation
      })
    }
  }

  ranges.sort((left, right) => left.startIndex - right.startIndex)
  const parts: ReactNode[] = []
  let cursor = 0

  ranges.forEach((range, index) => {
    if (range.startIndex < cursor) return

    parts.push(
      cleanChatFormatting(
        message.text.slice(cursor, range.startIndex)
      )
    )

    if (range.kind === 'external') {
      parts.push(
        <a
          key={`${range.url}-${index}`}
          href={range.url}
          target="_blank"
          rel="noreferrer"
          title={range.title}
        >
          {cleanChatFormatting(
            message.text.slice(
              range.startIndex,
              range.endIndex
            )
          )}
        </a>
      )
    } else {
      parts.push(
        <button
          key={`source-${range.citation.number}-${index}`}
          type="button"
          title={`Open ${range.citation.pageTitle}: ${range.citation.excerpt}`}
          onClick={() =>
            onOpenNotebookCitation?.(range.citation)
          }
        >
          {message.text.slice(range.startIndex, range.endIndex)}
        </button>
      )
    }

    cursor = range.endIndex
  })

  parts.push(cleanChatFormatting(message.text.slice(cursor)))
  return parts
}
