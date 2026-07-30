'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { LegalConsentGate } from '@/features/legal/LegalConsentGate'
import {
  QuizSetup,
  type QuizDifficulty,
  type QuizLength,
  type QuizScope
} from './QuizSetup'
import styles from './Quiz.module.css'

interface QuizQuestion {
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  source: {
    pageId: string
    pageTitle: string
  }
}

interface Quiz {
  title: string
  configuration: {
    scope: QuizScope
    length: QuizLength
    difficulty: QuizDifficulty
    questionCount: number
  }
  questions: QuizQuestion[]
}

function QuizPageContent({
  params
}: {
  params: Promise<{ notebookId: string }>
}) {
  const { notebookId } = use(params)
  const router = useRouter()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<
    Record<number, number>
  >({})
  const [submitted, setSubmitted] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPageId, setCurrentPageId] =
    useState<string | null>(null)
  const [scope, setScope] = useState<QuizScope>('notebook')
  const [length, setLength] =
    useState<QuizLength>('medium')
  const [difficulty, setDifficulty] =
    useState<QuizDifficulty>('balanced')

  useEffect(() => {
    const pageId = new URLSearchParams(
      window.location.search
    ).get('pageId')

    if (pageId) {
      setCurrentPageId(pageId)
      setScope('page')
    }
  }, [])

  const generateQuiz = async () => {
    setIsGenerating(true)
    setError(null)
    setSubmitted(false)
    setAnswers({})

    try {
      const response = await fetch('/api/ai/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notebookId,
          pageId: scope === 'page' ? currentPageId : undefined,
          scope,
          length,
          difficulty
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'Could not generate a quiz'
        )
      }

      setQuiz(result)
    } catch (quizError) {
      setError(
        quizError instanceof Error
          ? quizError.message
          : 'Could not generate a quiz'
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const score = quiz
    ? quiz.questions.reduce(
        (total, question, index) =>
          total +
          (answers[index] === question.correctIndex ? 1 : 0),
        0
      )
    : 0

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.back()}
        >
          ← Back
        </button>
        <div>
          <span className={styles.eyebrow}>SENTIA</span>
          <h1>Study Quiz</h1>
        </div>
        <button
          type="button"
          className={styles.generateButton}
          disabled={isGenerating}
          onClick={() => {
            if (quiz) {
              setQuiz(null)
              setSubmitted(false)
              setAnswers({})
            } else {
              void generateQuiz()
            }
          }}
        >
          {isGenerating
            ? 'Building from your notes…'
            : quiz
              ? 'Customize'
              : 'Generate Quiz'}
        </button>
      </header>

      {!quiz && !isGenerating && (
        <QuizSetup
          currentPageAvailable={Boolean(currentPageId)}
          difficulty={difficulty}
          length={length}
          scope={scope}
          onDifficultyChange={setDifficulty}
          onGenerate={() => void generateQuiz()}
          onLengthChange={setLength}
          onScopeChange={setScope}
        />
      )}

      {isGenerating && (
        <div className={styles.loadingState}>
          Indexing notes and finding important concepts…
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {quiz && !isGenerating && (
        <section className={styles.quiz}>
          <div className={styles.quizTitle}>
            <div>
              <span>
                {quiz.configuration.scope === 'page'
                  ? 'PAGE QUIZ'
                  : 'NOTEBOOK QUIZ'}
              </span>
              <h2>{quiz.title}</h2>
              <div className={styles.quizConfigSummary}>
                <span>{quiz.configuration.length}</span>
                <span>{quiz.configuration.difficulty}</span>
                <span>
                  {quiz.configuration.questionCount} questions
                </span>
              </div>
            </div>
            {submitted && (
              <strong>
                {score}/{quiz.questions.length} correct
              </strong>
            )}
          </div>

          {quiz.questions.map((question, questionIndex) => (
            <article
              className={styles.questionCard}
              key={`${questionIndex}-${question.question}`}
            >
              <span className={styles.questionNumber}>
                QUESTION {questionIndex + 1}
              </span>
              <h3>{question.question}</h3>
              <div className={styles.choices}>
                {question.choices.map((choice, choiceIndex) => {
                  const selected =
                    answers[questionIndex] === choiceIndex
                  const isCorrect =
                    submitted &&
                    choiceIndex === question.correctIndex
                  const isIncorrect =
                    submitted && selected && !isCorrect

                  return (
                    <button
                      type="button"
                      key={`${choiceIndex}-${choice}`}
                      disabled={submitted}
                      aria-pressed={selected}
                      className={[
                        selected ? styles.selectedChoice : '',
                        isCorrect ? styles.correctChoice : '',
                        isIncorrect ? styles.incorrectChoice : ''
                      ].join(' ')}
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [questionIndex]: choiceIndex
                        }))
                      }
                      onKeyDown={(event) => {
                        if (
                          ![
                            'ArrowUp',
                            'ArrowDown',
                            'ArrowLeft',
                            'ArrowRight',
                            'Home',
                            'End'
                          ].includes(event.key)
                        ) {
                          return
                        }

                        const choices = Array.from(
                          event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                            'button:not([disabled])'
                          ) ?? []
                        )
                        const currentIndex = choices.indexOf(
                          event.currentTarget
                        )

                        if (
                          currentIndex === -1 ||
                          choices.length === 0
                        ) {
                          return
                        }

                        event.preventDefault()

                        if (event.key === 'Home') {
                          choices[0].focus()
                        } else if (event.key === 'End') {
                          choices[choices.length - 1].focus()
                        } else {
                          const direction = [
                            'ArrowDown',
                            'ArrowRight'
                          ].includes(event.key)
                            ? 1
                            : -1
                          const nextIndex =
                            (currentIndex +
                              direction +
                              choices.length) %
                            choices.length
                          choices[nextIndex].focus()
                        }
                      }}
                    >
                      <span>
                        {String.fromCharCode(65 + choiceIndex)}
                      </span>
                      {choice}
                    </button>
                  )
                })}
              </div>

              {submitted && (
                <div className={styles.explanation}>
                  <p>{question.explanation}</p>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/editor/${question.source.pageId}`
                      )
                    }
                  >
                    Source: {question.source.pageTitle}
                  </button>
                </div>
              )}
            </article>
          ))}

          {!submitted && (
            <button
              type="button"
              className={styles.submitButton}
              disabled={
                Object.keys(answers).length !==
                quiz.questions.length
              }
              onClick={() => setSubmitted(true)}
            >
              Check Answers
            </button>
          )}
        </section>
      )}
    </main>
  )
}

export default function QuizPage({
  params
}: {
  params: Promise<{ notebookId: string }>
}) {
  return (
    <LegalConsentGate>
      <QuizPageContent params={params} />
    </LegalConsentGate>
  )
}
