'use client'

import styles from './Quiz.module.css'

export type QuizScope = 'notebook' | 'page'
export type QuizLength = 'short' | 'medium' | 'long'
export type QuizDifficulty =
  | 'foundational'
  | 'balanced'
  | 'challenging'

interface Option<T extends string> {
  value: T
  label: string
  detail: string
}

const LENGTH_OPTIONS: Option<QuizLength>[] = [
  { value: 'short', label: 'Short', detail: 'A quick review' },
  {
    value: 'medium',
    label: 'Medium',
    detail: 'A balanced session'
  },
  { value: 'long', label: 'Long', detail: 'A deeper review' }
]

const DIFFICULTY_OPTIONS: Option<QuizDifficulty>[] = [
  {
    value: 'foundational',
    label: 'Foundational',
    detail: 'Direct facts and definitions'
  },
  {
    value: 'balanced',
    label: 'Balanced',
    detail: 'Recall plus understanding'
  },
  {
    value: 'challenging',
    label: 'Challenging',
    detail: 'Application and inference'
  }
]

function OptionCards<T extends string>({
  options,
  value,
  onChange
}: {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className={styles.optionCards}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={
            value === option.value ? styles.optionActive : ''
          }
          onClick={() => onChange(option.value)}
        >
          <strong>{option.label}</strong>
          <span>{option.detail}</span>
        </button>
      ))}
    </div>
  )
}

export function QuizSetup({
  currentPageAvailable,
  difficulty,
  length,
  scope,
  onDifficultyChange,
  onGenerate,
  onLengthChange,
  onScopeChange
}: {
  currentPageAvailable: boolean
  difficulty: QuizDifficulty
  length: QuizLength
  scope: QuizScope
  onDifficultyChange: (value: QuizDifficulty) => void
  onGenerate: () => void
  onLengthChange: (value: QuizLength) => void
  onScopeChange: (value: QuizScope) => void
}) {
  return (
    <section className={styles.quizSetup}>
      <div className={styles.setupIntro}>
        <span>AI STUDY MODE</span>
        <h2>Build your study session</h2>
        <p>
          Choose what Sentia should test and how demanding the
          session should feel.
        </p>
      </div>

      <div className={styles.setupGrid}>
        <fieldset className={styles.optionGroup}>
          <legend>Scope</legend>
          <div className={styles.scopeOptions}>
            <button
              type="button"
              disabled={!currentPageAvailable}
              aria-pressed={scope === 'page'}
              className={
                scope === 'page' ? styles.optionActive : ''
              }
              onClick={() => onScopeChange('page')}
            >
              <strong>Current page</strong>
              <span>
                {currentPageAvailable
                  ? 'Focus on the page you came from'
                  : 'Launch from an editor page to enable'}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={scope === 'notebook'}
              className={
                scope === 'notebook' ? styles.optionActive : ''
              }
              onClick={() => onScopeChange('notebook')}
            >
              <strong>Whole notebook</strong>
              <span>Study across every available page</span>
            </button>
          </div>
        </fieldset>

        <fieldset className={styles.optionGroup}>
          <legend>Length</legend>
          <OptionCards
            options={LENGTH_OPTIONS}
            value={length}
            onChange={onLengthChange}
          />
        </fieldset>

        <fieldset className={styles.optionGroup}>
          <legend>Difficulty</legend>
          <OptionCards
            options={DIFFICULTY_OPTIONS}
            value={difficulty}
            onChange={onDifficultyChange}
          />
        </fieldset>

      </div>

      <button
        type="button"
        className={styles.setupGenerateButton}
        onClick={onGenerate}
      >
        Generate study session
      </button>
    </section>
  )
}
