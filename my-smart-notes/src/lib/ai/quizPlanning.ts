export const MIN_QUIZ_QUESTIONS = 3
export const MAX_QUIZ_QUESTIONS = 15
export type QuizLength = 'short' | 'medium' | 'long'

export function calculateQuizQuestionCount(
  characterCount: number
) {
  const contentBasedCount = Math.ceil(
    Math.max(0, characterCount) / 800
  )

  return Math.min(
    MAX_QUIZ_QUESTIONS,
    Math.max(MIN_QUIZ_QUESTIONS, contentBasedCount)
  )
}

export function calculateRequestedQuizQuestionCount(
  characterCount: number,
  length: QuizLength,
  random: () => number = Math.random
) {
  const availableQuestionCount =
    calculateQuizQuestionCount(characterCount)
  const requestedRange =
    length === 'short'
      ? { min: 3, max: 5 }
      : length === 'medium'
        ? { min: 6, max: 10 }
        : { min: 11, max: MAX_QUIZ_QUESTIONS }
  const maximum = Math.min(
    requestedRange.max,
    availableQuestionCount
  )
  const minimum = Math.min(requestedRange.min, maximum)
  const normalizedRandom = Math.min(
    0.999999,
    Math.max(0, random())
  )

  return (
    minimum +
    Math.floor(normalizedRandom * (maximum - minimum + 1))
  )
}

export function calculateQuizContextLimit(
  questionCount: number
) {
  return Math.min(
    24,
    Math.max(8, Math.ceil(questionCount * 1.5))
  )
}
