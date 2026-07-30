import { invokeMock } from './state.ts'

export class AiSafetyError extends Error {
  constructor(
    message = 'This AI request cannot be processed safely. Rephrase it and try again.'
  ) {
    super(message)
    this.name = 'AiSafetyError'
  }
}

export function moderateText(...args: any[]) {
  return invokeMock(
    'openai',
    'moderateText',
    args,
    () => undefined
  )
}

export function createEmbeddings(...args: any[]) {
  return invokeMock(
    'openai',
    'createEmbeddings',
    args,
    (texts: string[]) =>
      texts.map(() => Array.from({ length: 1536 }, () => 0))
  )
}

export function createGroundedAnswer(...args: any[]) {
  return invokeMock(
    'openai',
    'createGroundedAnswer',
    args,
    () => ({
      answer: 'Safe answer',
      externalCitations: []
    })
  )
}

export function createStructuredQuiz(...args: any[]) {
  return invokeMock(
    'openai',
    'createStructuredQuiz',
    args,
    () => ({
      title: 'Notebook quiz',
      questions: [
        question(1),
        question(1),
        question(1)
      ]
    })
  )
}

function question(sourceNumber: number) {
  return {
    question: 'Question?',
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Because A.',
    sourceNumber
  }
}
