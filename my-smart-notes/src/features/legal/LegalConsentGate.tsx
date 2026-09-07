'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import {
  LEGAL_CONSENT_SESSION_KEY,
  LEGAL_DOCUMENT_OPEN_EVENT
} from './constants'
import { legalAcceptancePath } from './navigation'

const LegalDocumentsModal = dynamic(() =>
  import('./LegalDocumentsModal').then(
    (module) => module.LegalDocumentsModal
  )
)

type ConsentState = 'checking' | 'accepted' | 'error'

export function LegalConsentGate({
  children
}: {
  children: React.ReactNode
}) {
  const [consentState, setConsentState] =
    useState<ConsentState>('checking')
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationAttempt, setVerificationAttempt] = useState(0)

  useEffect(() => {
    const handleOpenRequest = () => {
      setError(null)
      setIsDocumentsOpen(true)
    }

    window.addEventListener(
      LEGAL_DOCUMENT_OPEN_EVENT,
      handleOpenRequest
    )

    return () => {
      window.removeEventListener(
        LEGAL_DOCUMENT_OPEN_EVENT,
        handleOpenRequest
      )
    }
  }, [])

  useEffect(() => {
    let active = true

    const verifyConsent = async () => {
      setConsentState('checking')
      setError(null)

      if (
        sessionStorage.getItem(LEGAL_CONSENT_SESSION_KEY) ===
        'accepted'
      ) {
        setConsentState('accepted')
        return
      }

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

        if (!result.accepted) {
          const currentPath = `${window.location.pathname}${window.location.search}`
          window.location.replace(legalAcceptancePath(currentPath))
          return
        }

        sessionStorage.setItem(
          LEGAL_CONSENT_SESSION_KEY,
          'accepted'
        )
        setConsentState('accepted')
      } catch (consentError) {
        if (!active) return
        setError(
          consentError instanceof Error
            ? consentError.message
            : 'Could not verify legal acceptance.'
        )
        setConsentState('error')
      }
    }

    void verifyConsent()

    return () => {
      active = false
    }
  }, [verificationAttempt])

  if (consentState !== 'accepted') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080a0e] px-6 text-slate-100">
        <section className="w-full max-w-md rounded-lg border border-slate-700 bg-[#11151c] p-6">
          {consentState === 'error' ? (
            <>
              <h1 className="text-xl font-semibold">
                Sentia could not verify your account
              </h1>
              <p role="alert" className="mt-3 text-sm leading-6 text-slate-400">
                {error}
              </p>
              <button
                type="button"
                onClick={() =>
                  setVerificationAttempt((attempt) => attempt + 1)
                }
                className="mt-5 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700"
              >
                Try again
              </button>
            </>
          ) : (
            <p role="status" className="text-sm text-slate-400">
              Verifying your Sentia account…
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <>
      {children}
      <LegalDocumentsModal
        error={null}
        isOpen={isDocumentsOpen}
        isRequired={false}
        isSubmitting={false}
        onAccept={() => undefined}
        onClose={() => setIsDocumentsOpen(false)}
      />
    </>
  )
}
