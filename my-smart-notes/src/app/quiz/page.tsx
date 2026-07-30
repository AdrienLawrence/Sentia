'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { LegalConsentGate } from '@/features/legal/LegalConsentGate'
import type { DashboardNotebook } from '@/features/dashboard/model/types'
import styles from './[notebookId]/Quiz.module.css'

function QuizHubContent() {
  const router = useRouter()
  const [notebooks, setNotebooks] = useState<DashboardNotebook[]>([])
  const [selectedNotebookId, setSelectedNotebookId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadNotebooks = async () => {
      try {
        const response = await fetch('/api/notebooks')

        if (response.status === 401) {
          router.replace('/login')
          return
        }

        const result = await response.json()

        if (!response.ok || !Array.isArray(result)) {
          throw new Error(
            result?.error || 'Could not load your notebooks'
          )
        }

        if (cancelled) return

        setNotebooks(result)
        setSelectedNotebookId(result[0]?.id ?? '')
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load your notebooks'
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadNotebooks()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.push('/dashboard')}
        >
          ← Dashboard
        </button>
        <div>
          <span className={styles.eyebrow}>SENTIA</span>
          <h1>Study Quiz</h1>
        </div>
        <span aria-hidden="true" />
      </header>

      <section className={styles.quizSetup}>
        <div className={styles.setupIntro}>
          <span>AI STUDY MODE</span>
          <h2>Choose a notebook</h2>
          <p>
            Pick the notes you want to study. You can choose the
            quiz length and difficulty on the next screen.
          </p>
        </div>

        {isLoading && (
          <p className={styles.hubStatus}>Loading notebooks…</p>
        )}

        {error && <p className={styles.hubError}>{error}</p>}

        {!isLoading && !error && notebooks.length === 0 && (
          <div className={styles.hubEmptyState}>
            <p>Create or import a notebook before building a quiz.</p>
            <button
              type="button"
              className={styles.setupGenerateButton}
              onClick={() => router.push('/dashboard')}
            >
              Return to Dashboard
            </button>
          </div>
        )}

        {!isLoading && !error && notebooks.length > 0 && (
          <>
            <label
              className={styles.hubLabel}
              htmlFor="quiz-notebook"
            >
              Notebook
            </label>
            <select
              id="quiz-notebook"
              className={styles.hubSelect}
              value={selectedNotebookId}
              onChange={(event) =>
                setSelectedNotebookId(event.target.value)
              }
            >
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={styles.setupGenerateButton}
              disabled={!selectedNotebookId}
              onClick={() =>
                router.push(`/quiz/${selectedNotebookId}`)
              }
            >
              Continue
            </button>
          </>
        )}
      </section>
    </main>
  )
}

export default function QuizHubPage() {
  return (
    <LegalConsentGate>
      <QuizHubContent />
    </LegalConsentGate>
  )
}
