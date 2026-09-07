'use client'

import { useEffect, useRef, useState } from 'react'

import { LEGAL_CONSENT_SESSION_KEY } from '@/features/legal/constants'
import { LegalDocumentsModal } from '@/features/legal/LegalDocumentsModal'
import { safeLegalReturnPath } from '@/features/legal/navigation'

type PageState = 'checking' | 'review' | 'submitting'

export default function LegalAcceptancePage() {
  const [pageState, setPageState] = useState<PageState>('checking')
  const [error, setError] = useState<string | null>(null)
  const returnPathRef = useRef('/dashboard')

  useEffect(() => {
    let active = true
    returnPathRef.current = safeLegalReturnPath(
      new URLSearchParams(window.location.search).get('next')
    )

    const load = async () => {
      try {
        const response = await fetch('/api/legal-consent', {
          method: 'GET',
          cache: 'no-store'
        })
        const result = await response.json()

        if (!active) return

        if (response.status === 401) {
          const currentPath = `${window.location.pathname}${window.location.search}`
          window.location.replace(
            `/login?next=${encodeURIComponent(currentPath)}`
          )
          return
        }

        if (!response.ok) {
          throw new Error(
            result.error || 'Could not verify legal acceptance.'
          )
        }

        if (result.accepted) {
          sessionStorage.setItem(
            LEGAL_CONSENT_SESSION_KEY,
            'accepted'
          )
          window.location.replace(returnPathRef.current)
          return
        }

        setPageState('review')
      } catch (consentError) {
        if (!active) return
        setError(
          consentError instanceof Error
            ? consentError.message
            : 'Could not verify legal acceptance.'
        )
        setPageState('review')
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const acceptDocuments = async () => {
    if (pageState === 'submitting') return
    setPageState('submitting')
    setError(null)

    try {
      const response = await fetch('/api/legal-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyAccepted: true,
          termsAccepted: true
        })
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error || 'Could not save legal acceptance.'
        )
      }

      sessionStorage.setItem(
        LEGAL_CONSENT_SESSION_KEY,
        'accepted'
      )
      window.location.replace(returnPathRef.current)
    } catch (consentError) {
      setError(
        consentError instanceof Error
          ? consentError.message
          : 'Could not save legal acceptance.'
      )
      setPageState('review')
    }
  }

  if (pageState === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a0e] px-6 text-slate-100">
        <p role="status" className="text-sm text-slate-400">
          Checking your legal acceptance…
        </p>
      </main>
    )
  }

  return (
    <LegalDocumentsModal
      error={error}
      isOpen
      isRequired
      isSubmitting={pageState === 'submitting'}
      presentation="page"
      onAccept={() => void acceptDocuments()}
      onClose={() => undefined}
    />
  )
}
