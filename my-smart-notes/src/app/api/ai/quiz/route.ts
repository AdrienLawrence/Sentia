import { NextResponse } from 'next/server'

import {
  ApiRequestError,
  apiErrorResponse,
  assertAllowedKeys,
  assertUuid,
  parseJsonObject,
  readOptionalEnum,
  requireAuthenticatedUser,
  requireSameOrigin
} from '@/lib/apiSecurity'
import {
  AiSafetyError,
  createStructuredQuiz
} from '@/lib/ai/openai'
import {
  getNotebookQuizStats,
  indexOwnedNotebook,
  isRagDatabaseSetupError,
  retrieveNotebookQuizContext
} from '@/lib/ai/rag'
import {
  AI_DATA_BOUNDARY_INSTRUCTIONS,
  createSafetyIdentifier,
  serializeUntrustedAiData
} from '@/lib/ai/safety'
import {
  calculateQuizContextLimit,
  calculateRequestedQuizQuestionCount
} from '@/lib/ai/quizPlanning'

const QUIZ_SCOPES = ['notebook', 'page'] as const
const QUIZ_LENGTHS = [
  'short',
  'medium',
  'long'
] as const
const QUIZ_DIFFICULTIES = [
  'foundational',
  'balanced',
  'challenging'
] as const
const DIFFICULTY_PROMPTS = {
  foundational:
    'Use direct, approachable questions that reinforce definitions and core facts.',
  balanced:
    'Use a balanced mix of recall, understanding, and light application.',
  challenging:
    'Emphasize comparison, application, and inference. Use close but unambiguously incorrect distractors without trick wording.'
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const user = await requireAuthenticatedUser(request)
    const body = await parseJsonObject(request, 8_000)
    assertAllowedKeys(body, [
      'notebookId',
      'pageId',
      'scope',
      'length',
      'difficulty'
    ])

    if (typeof body.notebookId !== 'string') {
      throw new ApiRequestError('Invalid notebook ID')
    }

    assertUuid(body.notebookId, 'notebook ID')
    const scope =
      readOptionalEnum(body, 'scope', QUIZ_SCOPES) ?? 'notebook'
    const length =
      readOptionalEnum(body, 'length', QUIZ_LENGTHS) ?? 'medium'
    const difficulty =
      readOptionalEnum(
        body,
        'difficulty',
        QUIZ_DIFFICULTIES
      ) ?? 'balanced'
    const requestedPageId =
      body.pageId === undefined
        ? undefined
        : typeof body.pageId === 'string'
          ? body.pageId
          : null

    if (requestedPageId === null) {
      throw new ApiRequestError('Invalid page ID')
    }

    if (requestedPageId) {
      assertUuid(requestedPageId, 'page ID')
    }

    const pageId =
      scope === 'page'
        ? requestedPageId
        : undefined

    if (scope === 'page' && !pageId) {
      throw new ApiRequestError(
        'Choose a page before generating a page quiz'
      )
    }

    const indexed = await indexOwnedNotebook(
      user.id,
      body.notebookId
    )

    if (!indexed) {
      return NextResponse.json(
        { error: 'Notebook not found' },
        { status: 404 }
      )
    }

    const stats = await getNotebookQuizStats(
      user.id,
      body.notebookId,
      pageId
    )

    if (stats.chunkCount < 1) {
      throw new ApiRequestError(
        'Add some notes before generating a quiz'
      )
    }

    const questionCount = calculateRequestedQuizQuestionCount(
      stats.characterCount,
      length
    )
    const chunks = await retrieveNotebookQuizContext(
      user.id,
      body.notebookId,
      calculateQuizContextLimit(questionCount),
      pageId
    )

    const quiz = await createStructuredQuiz(
      serializeUntrustedAiData({
        requestedQuestionCount: questionCount,
        requestedScope: scope,
        requestedLength: length,
        requestedDifficulty: difficulty,
        notebookSources: chunks.map((chunk, index) => ({
          sourceNumber: index + 1,
          pageId: chunk.pageId,
          pageTitle: chunk.pageTitle,
          content: chunk.content
        }))
      }),
      [
        'You create source-grounded study quizzes.',
        AI_DATA_BOUNDARY_INSTRUCTIONS,
        `Generate exactly ${questionCount} multiple-choice questions.`,
        'Every question must be directly supported by one supplied source.',
        scope === 'notebook'
          ? 'Distribute questions across the supplied sources and notebook pages. Longer pages may support more questions than shorter pages.'
          : 'All questions must focus on the selected page represented by the supplied sources.',
        DIFFICULTY_PROMPTS[difficulty],
        'Use a natural mix of key concepts, factual recall, relationships, and light application when the notes support them.',
        'Use plausible but clearly incorrect distractors.',
        'sourceNumber must match the supporting sourceNumber.',
        'Use only the supplied sources.',
        'Do not invent facts that are absent from them.',
        'Avoid trick questions and ambiguous wording.'
      ].join(' '),
      questionCount,
      createSafetyIdentifier(user.id)
    )

    const questions = quiz.questions
      .slice(0, questionCount)
      .filter(
        (question) =>
          Number.isInteger(question.sourceNumber) &&
          question.sourceNumber >= 1 &&
          question.sourceNumber <= chunks.length
      )
      .map((question) => {
        const source = chunks[question.sourceNumber - 1]

        return {
          ...question,
          source: {
            pageId: source.pageId,
            pageTitle: source.pageTitle
          }
        }
      })

    if (questions.length < 3) {
      throw new Error('AI provider returned an invalid quiz')
    }

    return NextResponse.json({
      title: quiz.title,
      configuration: {
        scope,
        length,
        difficulty,
        questionCount: questions.length
      },
      questions
    })
  } catch (error) {
    if (error instanceof AiSafetyError) {
      return NextResponse.json(
        { error: error.message },
        { status: 422 }
      )
    }

    if (isRagDatabaseSetupError(error)) {
      return NextResponse.json(
        {
          error:
            'Sentia search is not configured yet. Apply the RAG database migration and try again.'
        },
        { status: 503 }
      )
    }

    return apiErrorResponse(error, 'Failed to generate quiz')
  }
}
