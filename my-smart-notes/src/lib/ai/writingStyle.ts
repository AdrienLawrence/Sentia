import { tiptapToTextBlocks } from '@/lib/ai/tiptapText'

type TiptapNode = {
  type?: string
  content?: TiptapNode[]
}

function countNodeTypes(
  node: TiptapNode,
  counts: Record<string, number>
) {
  if (node.type) counts[node.type] = (counts[node.type] ?? 0) + 1
  for (const child of node.content ?? []) countNodeTypes(child, counts)
}

function roundedAverage(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(
    values.reduce((total, value) => total + value, 0) /
      values.length
  )
}

export function deriveWritingStyle(content: unknown) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return null
  }

  const blocks = tiptapToTextBlocks(content)
  const text = blocks.join('\n')
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []

  if (words.length < 40) return null

  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  const sentenceLengths = sentences.map(
    (sentence) =>
      sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
  )
  const blockLengths = blocks.map(
    (block) =>
      block.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
  )
  const averageSentenceWords = roundedAverage(sentenceLengths)
  const averageBlockWords = roundedAverage(blockLengths)
  const counts: Record<string, number> = {}
  countNodeTypes(content as TiptapNode, counts)

  const sentenceRhythm =
    averageSentenceWords <= 10
      ? 'short, direct sentences and fragments'
      : averageSentenceWords <= 18
        ? 'medium-length, direct sentences'
        : 'longer, connected explanatory sentences'
  const paragraphRhythm =
    averageBlockWords <= 20
      ? 'compact paragraphs'
      : averageBlockWords <= 50
        ? 'moderate paragraphs'
        : 'extended paragraphs'
  const structure =
    (counts.listItem ?? 0) >= Math.max(3, blocks.length / 3)
      ? 'frequent lists'
      : (counts.heading ?? 0) >= 2
        ? 'heading-led organization'
        : 'primarily prose organization'
  const contractions = (text.match(/\b\p{L}+[’'](?:t|s|re|ve|ll|d|m)\b/giu) ?? [])
    .length
  const tone = contractions >= Math.max(2, sentences.length / 5)
    ? 'conversational contractions'
    : 'mostly expanded, neutral phrasing'
  const punctuation: string[] = []

  if ((text.match(/:/g) ?? []).length >= 2) punctuation.push('colons')
  if ((text.match(/;/g) ?? []).length >= 2) punctuation.push('semicolons')
  if ((text.match(/[—–]/g) ?? []).length >= 2) punctuation.push('dashes')
  if ((text.match(/\?/g) ?? []).length >= 2) punctuation.push('questions')

  return [
    sentenceRhythm,
    paragraphRhythm,
    structure,
    tone,
    counts.codeBlock ? 'preserves code blocks when relevant' : null,
    punctuation.length > 0
      ? `recurring use of ${punctuation.join(', ')}`
      : 'light punctuation'
  ]
    .filter(Boolean)
    .join('; ')
}
