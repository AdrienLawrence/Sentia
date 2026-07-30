const OPENAI_API_URL = 'https://api.openai.com/v1'
const DEFAULT_RESPONSE_MODEL = 'gpt-5.6-terra'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const DEFAULT_MODERATION_MODEL = 'omni-moderation-latest'

export class AiSafetyError extends Error {
  constructor(
    message = 'This AI request cannot be processed safely. Rephrase it and try again.'
  ) {
    super(message)
    this.name = 'AiSafetyError'
  }
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  return apiKey
}

async function openAiRequest<T>(
  path: string,
  body: Record<string, unknown>
) {
  const response = await fetch(`${OPENAI_API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000)
  })

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id')

    console.error('ai.openai_request_failed', {
      path,
      status: response.status,
      requestId
    })

    throw new Error(`AI provider request failed (${response.status})`)
  }

  return (await response.json()) as T
}

export async function createEmbeddings(texts: string[]) {
  if (texts.length === 0) return []

  const result = await openAiRequest<{
    data: Array<{ index: number; embedding: number[] }>
  }>('/embeddings', {
    model:
      process.env.OPENAI_EMBEDDING_MODEL ??
      DEFAULT_EMBEDDING_MODEL,
    input: texts,
    encoding_format: 'float'
  })

  return result.data
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding)
}

interface UrlCitationAnnotation {
  type?: string
  url?: string
  title?: string
  start_index?: number
  end_index?: number
}

interface OpenAiTextResponse {
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
      annotations?: UrlCitationAnnotation[]
    }>
  }>
}

function responseText(result: OpenAiTextResponse) {
  return (
    result.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === 'output_text')
      .map((item) => item.text ?? '')
      .join('')
      .trim() ?? ''
  )
}

function externalCitations(result: OpenAiTextResponse) {
  const citations = result.output
    ?.flatMap((item) => item.content ?? [])
    .flatMap((item) => item.annotations ?? [])
    .filter(
      (
        annotation
      ): annotation is UrlCitationAnnotation & {
        url: string
        title: string
        start_index: number
        end_index: number
      } =>
        annotation.type === 'url_citation' &&
        typeof annotation.url === 'string' &&
        /^https?:\/\//i.test(annotation.url) &&
        typeof annotation.title === 'string' &&
        typeof annotation.start_index === 'number' &&
        typeof annotation.end_index === 'number'
    )
    .map((annotation) => ({
      url: annotation.url,
      title: annotation.title,
      startIndex: annotation.start_index,
      endIndex: annotation.end_index
    })) ?? []

  return citations.filter(
    (citation, index) =>
      citations.findIndex(
        (candidate) => candidate.url === citation.url
      ) === index
  )
}

export async function moderateText(text: string) {
  if (!text.trim()) return

  const result = await openAiRequest<{
    results?: Array<{ flagged?: boolean }>
  }>('/moderations', {
    model:
      process.env.OPENAI_MODERATION_MODEL ??
      DEFAULT_MODERATION_MODEL,
    input: text
  })

  if (
    !Array.isArray(result.results) ||
    result.results.length < 1
  ) {
    throw new Error('AI provider returned invalid moderation data')
  }

  if (result.results.some((item) => item.flagged === true)) {
    throw new AiSafetyError()
  }
}

export async function createGroundedAnswer(
  prompt: string,
  instructions: string,
  options: {
    webSearch?: 'off' | 'auto' | 'required'
    maxOutputTokens?: number
    safetyIdentifier?: string
  } = {}
) {
  const body: Record<string, unknown> = {
    model:
      process.env.OPENAI_RESPONSE_MODEL ??
      DEFAULT_RESPONSE_MODEL,
    instructions,
    input: prompt,
    reasoning: { effort: 'low' },
    max_output_tokens: options.maxOutputTokens ?? 900,
    store: false
  }

  if (options.safetyIdentifier) {
    body.safety_identifier = options.safetyIdentifier
  }

  if (options.webSearch && options.webSearch !== 'off') {
    body.tools = [
      {
        type: 'web_search',
        search_context_size: 'medium'
      }
    ]
    body.tool_choice = options.webSearch
  }

  const result = await openAiRequest<OpenAiTextResponse>(
    '/responses',
    body
  )

  const answer = responseText(result)

  if (!answer) {
    throw new Error('AI provider returned an empty response')
  }

  await moderateText(answer)

  return {
    answer,
    externalCitations: externalCitations(result)
  }
}

export async function createStructuredQuiz(
  prompt: string,
  instructions: string,
  maximumQuestions = 10,
  safetyIdentifier?: string
) {
  const result = await openAiRequest<OpenAiTextResponse>(
    '/responses',
    {
    model:
      process.env.OPENAI_RESPONSE_MODEL ??
      DEFAULT_RESPONSE_MODEL,
    instructions,
    input: prompt,
    reasoning: { effort: 'low' },
    store: false,
    ...(safetyIdentifier
      ? { safety_identifier: safetyIdentifier }
      : {}),
    max_output_tokens: Math.min(
      4_000,
      700 + maximumQuestions * 220
    ),
    text: {
      format: {
        type: 'json_schema',
        name: 'notebook_quiz',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'questions'],
          properties: {
            title: { type: 'string' },
            questions: {
              type: 'array',
              minItems: 3,
              maxItems: maximumQuestions,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'question',
                  'choices',
                  'correctIndex',
                  'explanation',
                  'sourceNumber'
                ],
                properties: {
                  question: { type: 'string' },
                  choices: {
                    type: 'array',
                    minItems: 4,
                    maxItems: 4,
                    items: { type: 'string' }
                  },
                  correctIndex: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 3
                  },
                  explanation: { type: 'string' },
                  sourceNumber: {
                    type: 'integer',
                    minimum: 1
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  )

  const json = responseText(result)

  if (!json) {
    throw new Error('AI provider returned an empty quiz')
  }

  await moderateText(json)

  return JSON.parse(json) as {
    title: string
    questions: Array<{
      question: string
      choices: string[]
      correctIndex: number
      explanation: string
      sourceNumber: number
    }>
  }
}
