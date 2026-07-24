'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  questions: QuizQuestion[]
}

export default function QuizPage({
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
          questionCount: 8
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
          ← Editor
        </button>
        <div>
          <span className={styles.eyebrow}>SCRIBEAI</span>
          <h1>Study Quiz</h1>
        </div>
        <button
          type="button"
          className={styles.generateButton}
          disabled={isGenerating}
          onClick={() => void generateQuiz()}
        >
          {isGenerating
            ? 'Building from your notes…'
            : quiz
              ? 'New Quiz'
              : 'Generate Quiz'}
        </button>
      </header>

      {!quiz && !isGenerating && (
        <section className={styles.emptyState}>
          <span>AI STUDY MODE</span>
          <h2>Quiz this notebook</h2>
          <p>
            ScribeAI retrieves relevant passages from your notebook
            and builds eight source-grounded questions.
          </p>
          <button
            type="button"
            onClick={() => void generateQuiz()}
          >
            Generate eight questions
          </button>
        </section>
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
              <span>NOTEBOOK QUIZ</span>
              <h2>{quiz.title}</h2>
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
