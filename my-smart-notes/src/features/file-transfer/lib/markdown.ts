type TiptapMark = {
  type?: string
  attrs?: Record<string, unknown>
}

type TiptapNode = {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

function serializeMarkedText(node: TiptapNode) {
  let value = node.text ?? ''

  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') value = `**${value}**`
    if (mark.type === 'italic') value = `*${value}*`
    if (mark.type === 'strike') value = `~~${value}~~`
    if (mark.type === 'code') value = `\`${value}\``

    if (
      mark.type === 'link' &&
      typeof mark.attrs?.href === 'string'
    ) {
      value = `[${value}](${mark.attrs.href})`
    }
  }

  return value
}

function serializeChildren(node: TiptapNode, depth = 0) {
  return (node.content ?? [])
    .map((child) => serializeMarkdownNode(child, depth))
    .join('')
}

function serializeListItem(node: TiptapNode, depth: number) {
  const [firstBlock, ...remainingBlocks] = node.content ?? []
  const firstLine = firstBlock
    ? serializeMarkdownNode(firstBlock, depth).trim()
    : ''
  const remaining = remainingBlocks
    .map((child) => serializeMarkdownNode(child, depth + 1))
    .join('')
    .trimEnd()

  return remaining ? `${firstLine}\n${remaining}` : firstLine
}

function serializeMarkdownNode(
  node: TiptapNode,
  depth = 0
): string {
  if (node.type === 'text') return serializeMarkedText(node)
  if (node.type === 'hardBreak') return '  \n'

  if (node.type === 'doc') {
    return serializeChildren(node, depth).trim()
  }

  if (node.type === 'paragraph') {
    return `${serializeChildren(node, depth)}\n\n`
  }

  if (node.type === 'heading') {
    const level =
      typeof node.attrs?.level === 'number'
        ? Math.min(6, Math.max(1, node.attrs.level))
        : 1

    return `${'#'.repeat(level)} ${serializeChildren(
      node,
      depth
    )}\n\n`
  }

  if (node.type === 'bulletList') {
    return `${(node.content ?? [])
      .map(
        (item) =>
          `${'  '.repeat(depth)}- ${serializeListItem(
            item,
            depth
          )}`
      )
      .join('\n')}\n\n`
  }

  if (node.type === 'orderedList') {
    const start =
      typeof node.attrs?.start === 'number' ? node.attrs.start : 1

    return `${(node.content ?? [])
      .map(
        (item, index) =>
          `${'  '.repeat(depth)}${start + index}. ${serializeListItem(
            item,
            depth
          )}`
      )
      .join('\n')}\n\n`
  }

  if (node.type === 'blockquote') {
    const value = serializeChildren(node, depth).trim()
    return `${value
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}\n\n`
  }

  if (node.type === 'codeBlock') {
    return `\`\`\`\n${serializeChildren(node, depth)}\n\`\`\`\n\n`
  }

  if (node.type === 'horizontalRule') return '---\n\n'

  return serializeChildren(node, depth)
}

export function tiptapDocumentToMarkdown(content: unknown) {
  if (!content || typeof content !== 'object') return ''
  return serializeMarkdownNode(content as TiptapNode).trim()
}
