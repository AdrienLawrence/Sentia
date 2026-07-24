import { createHash } from 'node:crypto'

type TiptapNode = {
  type?: string
  text?: string
  content?: TiptapNode[]
}

function nodeText(node: TiptapNode): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }

  if (node.type === 'hardBreak') {
    return '\n'
  }

  return (node.content ?? []).map(nodeText).join('')
}

function collectBlocks(node: TiptapNode, blocks: string[]) {
  const blockTypes = new Set([
    'paragraph',
    'heading',
    'codeBlock',
    'blockquote',
    'listItem'
  ])

  if (node.type && blockTypes.has(node.type)) {
    const text = nodeText(node).replace(/\s+/g, ' ').trim()

    if (text) blocks.push(text)

    if (node.type === 'listItem') return
  }

  for (const child of node.content ?? []) {
    collectBlocks(child, blocks)
  }
}

export function tiptapToTextBlocks(content: unknown) {
  if (
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content)
  ) {
    return []
  }

  const blocks: string[] = []
  collectBlocks(content as TiptapNode, blocks)
  return blocks
}

export function chunkTiptapContent(
  content: unknown,
  maxCharacters = 1200
) {
  const blocks = tiptapToTextBlocks(content)
  const chunks: string[] = []
  let current = ''

  for (const block of blocks) {
    if (block.length > maxCharacters) {
      if (current) {
        chunks.push(current)
        current = ''
      }

      for (let start = 0; start < block.length; start += 1000) {
        chunks.push(block.slice(start, start + maxCharacters))
      }

      continue
    }

    const candidate = current ? `${current}\n${block}` : block

    if (candidate.length > maxCharacters) {
      chunks.push(current)
      current = block
    } else {
      current = candidate
    }
  }

  if (current) chunks.push(current)

  return chunks
}

export function contentHash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}
